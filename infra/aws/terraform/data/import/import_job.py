import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import boto3
import psycopg2
from psycopg2.extras import execute_values

# === [ENV CONFIG] 환경 변수 설정 ===
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET = os.getenv("S3_BUCKET", "ktcloud2nd-dev-data")

RDS_HOST = os.getenv("RDS_HOST")
RDS_PORT = int(os.getenv("RDS_PORT", "5432"))
RDS_DB = os.getenv("RDS_DB", "vehicle_db")
RDS_USER = os.getenv("RDS_USER", "dbadmin")
RDS_PASSWORD = os.getenv("RDS_PASSWORD")

# === [S3 PATH CONFIG] S3 경로 설정 ===
PREFIX_INCOMING = "processed/incoming/"
PREFIX_DONE = "processed/done/"
PREFIX_ERROR = "processed/error/"

# === [WORKER CONFIG] 실행 주기 / retention 설정 ===
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))
TELEMETRY_RETENTION_SECONDS = int(os.getenv("TELEMETRY_RETENTION_SECONDS", "3600"))


# === [VALIDATION] 필수 환경변수 체크 ===
def require_env() -> None:
    required = {
        "RDS_HOST": RDS_HOST,
        "RDS_PASSWORD": RDS_PASSWORD,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise ValueError(f"필수 환경변수가 없습니다: {', '.join(missing)}")


# === [AWS CLIENT] S3 클라이언트 생성 ===
def get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


# === [DB CONNECT] RDS 연결 ===
def get_db_connection():
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        dbname=RDS_DB,
        user=RDS_USER,
        password=RDS_PASSWORD,
    )


# === [S3 MOVE] 파일 이동 (incoming → done/error) ===
def move_s3_object(s3, source_key: str, target_key: str):
    s3.copy_object(
        Bucket=S3_BUCKET,
        CopySource={"Bucket": S3_BUCKET, "Key": source_key},
        Key=target_key,
    )
    s3.delete_object(Bucket=S3_BUCKET, Key=source_key)


# === [S3 LIST] 처리 대상 파일 조회 ===
def list_incoming_object_keys(s3) -> List[str]:
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET, Prefix=PREFIX_INCOMING)

    objects = []
    for page in pages:
        for item in page.get("Contents", []):
            key = item["Key"]
            if not key.endswith("/"):
                objects.append(item)

    objects.sort(key=lambda x: x["LastModified"])
    return [obj["Key"] for obj in objects]


# === [S3 READ] JSONL 파일 읽기 ===
def read_jsonl_from_s3(s3, key: str) -> List[Dict[str, Any]]:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
    lines = obj["Body"].read().decode("utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


# === [UTIL] boolean 파싱 ===
def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "1", "t", "yes", "y")


# === [UTIL] mode 파싱 ===
def parse_mode(value: Any) -> int:
    if isinstance(value, int):
        return value

    value_str = str(value).strip().lower()
    mode_map = {
        "driving": 1,
        "stopped": 2,
        "off": 3,
    }

    if value_str in mode_map:
        return mode_map[value_str]

    if value_str.isdigit():
        return int(value_str)

    raise ValueError(f"지원하지 않는 mode 값: {value}")


# === [UTIL] epoch → datetime 변환 ===
def epoch_to_datetime(epoch_seconds: int) -> datetime:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc)


# === [FILTER] telemetry 데이터 필터링 ===
def filter_rows_for_stats_and_history(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [row for row in rows if row.get("event_type") == 1]


# === [INSERT] telemetry history 적재 ===
def import_vehicle_telemetry_history(conn, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return

    values = [
        (
            row["vehicle_id"],
            float(row["lat"]),
            float(row["lon"]),
            int(row["speed"]),
            float(row["fuel"]),
            parse_bool(row["engine_on"]),
            parse_mode(row["mode"]),
            int(row["event_type"]),
            epoch_to_datetime(int(row["timestamp"])),
            datetime.now(timezone.utc),
        )
        for row in rows
    ]

    sql = """
        INSERT INTO vehicle_telemetry_history (
            vehicle_id, latitude, longitude, speed,
            fuel_level, engine_on, mode, event_type,
            occurred_at, received_at
        )
        VALUES %s
        ON CONFLICT DO NOTHING
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)


# === [CLEANUP] 오래된 telemetry 삭제 (sliding window) ===
def cleanup_old_vehicle_telemetry_history(conn) -> None:
    sql = """
        DELETE FROM vehicle_telemetry_history
        WHERE received_at < NOW() - (%s * INTERVAL '1 second')
    """

    with conn.cursor() as cur:
        cur.execute(sql, (TELEMETRY_RETENTION_SECONDS,))


# === [UPSERT] vehicle_stats 최신 상태 갱신 ===
def import_vehicle_stats(conn, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return

    latest_by_vehicle: Dict[str, Dict[str, Any]] = {}

    for row in rows:
        vehicle_id = row["vehicle_id"]
        ts = int(row["timestamp"])

        if vehicle_id not in latest_by_vehicle or ts >= latest_by_vehicle[vehicle_id]["ts"]:
            latest_by_vehicle[vehicle_id] = {
                "ts": ts,
                "row": (
                    vehicle_id,
                    float(row["lat"]),
                    float(row["lon"]),
                    int(row["speed"]),
                    float(row["fuel"]),
                    parse_bool(row["engine_on"]),
                    parse_mode(row["mode"]),
                    int(row["event_type"]),
                    epoch_to_datetime(ts),
                    datetime.now(timezone.utc),
                ),
            }

    values = [item["row"] for item in latest_by_vehicle.values()]

    sql = """
        INSERT INTO vehicle_stats (
            vehicle_id, latitude, longitude, speed,
            fuel_level, engine_on, mode, event_type,
            occurred_at, received_at
        )
        VALUES %s
        ON CONFLICT (vehicle_id)
        DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            speed = EXCLUDED.speed,
            fuel_level = EXCLUDED.fuel_level,
            engine_on = EXCLUDED.engine_on,
            mode = EXCLUDED.mode,
            event_type = EXCLUDED.event_type,
            occurred_at = EXCLUDED.occurred_at,
            received_at = EXCLUDED.received_at
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)


# === [PIPELINE] 파일 1개 처리 ===
def process_one_file(s3, conn, s3_key: str) -> None:
    rows = read_jsonl_from_s3(s3, s3_key)
    telemetry_rows = filter_rows_for_stats_and_history(rows)

    import_vehicle_telemetry_history(conn, telemetry_rows)
    cleanup_old_vehicle_telemetry_history(conn)
    import_vehicle_stats(conn, telemetry_rows)

    # 파일 단위 commit
    conn.commit()

    filename = s3_key.split("/")[-1]
    move_s3_object(s3, s3_key, f"{PREFIX_DONE}{filename}")


# === [WORKER] 메인 루프 ===
def main():
    require_env()
    s3 = get_s3_client()

    while True:
        conn = None
        try:
            incoming_keys = list_incoming_object_keys(s3)

            for incoming_key in incoming_keys:
                conn = get_db_connection()

                try:
                    process_one_file(s3, conn, incoming_key)
                except Exception as e:
                    if conn:
                        conn.rollback()
                    print(f"처리 실패: {incoming_key} / {e}")

                    error_filename = incoming_key.split("/")[-1]
                    move_s3_object(s3, incoming_key, f"{PREFIX_ERROR}{error_filename}")
                finally:
                    if conn:
                        conn.close()
                        conn = None

        except Exception as e:
            print(f"worker loop 오류: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()