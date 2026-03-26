# Lambda를 이용한 S3 to RDS 파이프라인 구축 예정이었으나,
# 계획 변경으로 무산 (혹여나 Lambda를 사용하게 될 경우를 대비해 주석 처리)

'''
import json
import os
import boto3
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone

# DB 연결 정보 (Terraform 환경변수(lambda.tf에 정의)에서 가져옴)
DB_HOST = os.environ['DB_HOST']
DB_NAME = os.environ['DB_NAME']
DB_USER = os.environ['DB_USER']
DB_PASS = os.environ['DB_PASS']

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    conn = None
    try:
        # S3에서 파일 정보 가져오기
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        response = s3_client.get_object(Bucket=bucket, Key=key)
        raw_data = json.loads(response['Body'].read().decode('utf-8'))
        
        # 데이터를 리스트로 변환 (for문 돌리기 위함)
        if not isinstance(raw_data, list):
            raw_data = [raw_data]


        now = datetime.now(timezone.utc) # 모든 테이블 공통 수신 시간
        # RDS 연결
        conn = psycopg2.connect(
            host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS
        )
        cur = conn.cursor()

        # vehicle_stats 테이블에 삽입
        stats_sql = """
            INSERT INTO vehicle_stats (vehicle_id, latitude, longitude, speed, fuel_level, engine_on, mode, event_type, occurred_at, received_at)
            VALUES %s
            ON CONFLICT (vehicle_id) DO UPDATE SET
                latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                speed = EXCLUDED.speed, fuel_level = EXCLUDED.fuel_level,
                engine_on = EXCLUDED.engine_on, occurred_at = EXCLUDED.occurred_at,
                received_at = NOW();
        """
        stats_values = [
            (d['vehicle_id'], d['lat'], d['lon'], d['speed'], d['fuel'], d['engine_on'], d['mode'], d['event_type'], datetime.fromtimestamp(d['timestamp'], tz=timezone.utc), datetime.now(timezone.utc))
            for d in raw_data
        ]
        execute_values(cur, stats_sql, stats_values)

        # vehicle_history 테이블에 삽입
        history_sql = """
            INSERT INTO vehicle_history (vehicle_id, speed, fuel_level, latitude, longitude, occurred_at, received_at)
            VALUES %s;
        """
        history_values = [
            (d['vehicle_id'], d['speed'], d['fuel'], d['lat'], d['lon'], datetime.fromtimestamp(d['timestamp'], tz=timezone.utc), datetime.now(timezone.utc))
            for d in raw_data
        ]
        execute_values(cur, history_sql, history_values)

        # (선택) 이상 탐지 스크립트 위치
        # 만약 람다(실시간성)로 진행할 거라면,
        # 여기에 anomaly_detector.py 수정해서 넣으면 됩니다.
        # 안하면, 람다는 단순 S3 to RDS 파이프라인으로 사용됩니다.

        # 윈도우 슬라이딩 (2분 지난 데이터 삭제)
        cur.execute("DELETE FROM vehicle_history WHERE occurred_at < NOW() - INTERVAL '120 second';")

        conn.commit()
        print(f"Successfully processed {len(raw_data)} records from {key}")

    except Exception as e:
        print(f"Error: {e}")
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()
'''