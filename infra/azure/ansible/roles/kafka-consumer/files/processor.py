import os
import json
import time
from kafka import KafkaConsumer, KafkaProducer

# 환경변수에서 브로커 주소 가져오기
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
RAW_TOPIC = 'raw_topic'
CLEANSED_TOPIC = 'cleansed_topic'

print(f"정제 연결 대상 브로커: {KAFKA_BROKER}")

# 카프카 연결
def create_kafka_clients():
    while True:
        try:
            consumer = KafkaConsumer(
                RAW_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                group_id='vehicle-cleanser-group',
                value_deserializer=lambda x: json.loads(x.decode('utf-8'))
            )
            
            producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda x: json.dumps(x).encode('utf-8')
            )
            print("Kafka Broker 연결 성공")
            return consumer, producer
        except Exception as e:
            print(f"Broker가 아직 준비되지 않았습니다. 5초 후 재시도... ({e})")
            time.sleep(5)

consumer, producer = create_kafka_clients()

# 데이터 정제(Cleansing) 함수
def process_data(data):
    # 마스킹: 운전자 코드가 있으면 숨김 처리
    if 'driver_id' in data:
        data['driver_id'] = '***MASKED***'
    
    # 노이즈/이상치 필터링
    # GPS가 지구 좌표계를 벗어났거나, 속도가 비정상적(300km/h 초과)이면 버림
    if not (-90 <= data.get('lat', 0) <= 90) or not (-180 <= data.get('lon', 0) <= 180):
        print("비정상 GPS 데이터 폐기")
        return None
    if data.get('speed', 0) < 0 or data.get('speed', 0) > 300:
        print("비정상 속도 데이터 폐기")
        return None
        
    # 서버 수신 시간(Ingestion Time) 보강
    # 데이터가 카프카를 거쳐 파이썬에 도달한 현재 서버 시간을 유닉스 타임으로 추가
    data['server_timestamp'] = int(time.time())

    return data

# 실시간 무한 스트리밍 처리 루프
print(f"🎧 '{RAW_TOPIC}' 구독 중... 차량 데이터 대기 중...")
try:
    for message in consumer:
        raw_data = message.value
        # 원본 데이터가 어떤 차량(Key)의 데이터인지 확인
        original_key = message.key 
        
        print(f"수신 원본: {raw_data}")
        
        # 정제기 가동
        cleansed_data = process_data(raw_data)
        
        if cleansed_data:
            # ★ 정제된 데이터를 쏠 때도 원본의 Key를 그대로 유지해서 전송
            producer.send(
                CLEANSED_TOPIC, 
                key=original_key, 
                value=cleansed_data
            )
            print(f"정제 완료/전송: {cleansed_data}")
        else:
            print("비정상 데이터 필터링(폐기)됨")

except KeyboardInterrupt:
    print("프로세스 종료 신호 감지...")
finally:
    consumer.close()
    producer.close()
    print("Kafka 연결이 안전하게 종료되었습니다.")