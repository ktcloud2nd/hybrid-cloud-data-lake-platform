import os
import json
import time
import threading
from kafka import KafkaConsumer, KafkaProducer

# 환경변수 및 토픽 설정
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
RAW_TOPIC = 'raw_topic'
CLEANSED_TOPIC = 'cleansed_topic'
ANOMALY_TOPIC = 'anomaly_topic'

print(f"--- 통합 프로세서 가동 시작 (Broker: {KAFKA_BROKER}) ---")

# 카프카 클라이언트 연결 함수
def create_kafka_clients():
    while True:
        try:
            consumer = KafkaConsumer(
                RAW_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                group_id='vehicle-processor-group',
                value_deserializer=lambda x: json.loads(x.decode('utf-8'))
            )
            producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda x: json.dumps(x).encode('utf-8')
            )
            print("Kafka Broker 연결 성공")
            return consumer, producer
        except Exception as e:
            print(f"Broker 연결 대기 중... ({e})")
            time.sleep(5)

consumer, producer = create_kafka_clients()

# 차량별 이전 상태 저장용 메모리 (판단 근거)
vehicle_states = {}

# 이상 탐지 전송 함수 (실속형: 핵심 증거만 전송)
def send_alert(vehicle_id, anomaly_type, description, evidence_value, timestamp):
    """ 이상 징후 발생 시 필요한 수치만 골라 별도 토픽으로 전송 """
    alert = {
        "alert_time": int(time.time()),   # 서버 감지 시각
        "vehicle_id": vehicle_id,         # 대상 차량
        "anomaly_type": anomaly_type,     # 이상 종류 (필터링용)
        "description": description,       # 상황 설명 (제목)
        "evidence": str(evidence_value),  # 핵심 증거 수치 (비용 최적화)
        "occurred_at": timestamp          # 실제 발생 시각
    }
    # 차량 ID를 키로 지정하여 순서 보장 전송
    producer.send(ANOMALY_TOPIC, key=str(vehicle_id).encode('utf-8'), value=alert)
    print(f"[알람 발송] {vehicle_id}: {anomaly_type} ({evidence_value})")

# 백그라운드 스레드: 30초 미수신 감시
def monitor_missing_data():
    while True:
        now = time.time()
        for v_id, state in list(vehicle_states.items()):
            # 마지막 수신 후 30초 경과 및 알람 미발송 상태 체크
            if now - state['last_seen'] >= 30 and not state.get('missing_alert_sent', False):
                send_alert(v_id, "MISSING_DATA", "30초 이상 데이터 미수신", "None", int(now))
                state['missing_alert_sent'] = True
        time.sleep(5)

threading.Thread(target=monitor_missing_data, daemon=True).start()

# 실시간 메시지 처리 루프
print(f"실시간 정제 및 이상 탐지 루프 시작...")

try:
    for message in consumer:
        raw_data = message.value
        v_id = raw_data.get('vehicle_id')
        original_key = message.key
        # 시뮬레이터가 보낸 발생 시각 (기본값은 현재시간)
        v_timestamp = raw_data.get('timestamp', int(time.time()))
        now = time.time()

        if not v_id: continue

        # --- 상태 업데이트 및 복구 확인 ---
        if v_id not in vehicle_states:
            vehicle_states[v_id] = {
                "last_speed": raw_data.get('speed', 0),
                "last_lat": raw_data.get('lat', 0),
                "last_seen": now,
                "msg_times": [now],
                "missing_alert_sent": False
            }
        
        state = vehicle_states[v_id]
        state['last_seen'] = now
        
        if state.get('missing_alert_sent'):
            print(f"[복구 확인] {v_id} 차량 통신 재개")
            state['missing_alert_sent'] = False

        # --- 이상 탐지 로직 (Evidence 추출) ---
        
        # 데이터 폭주 (초당 메시지 개수)
        state['msg_times'].append(now)
        state['msg_times'] = [t for t in state['msg_times'] if now - t <= 1.0]
        msg_count = len(state['msg_times'])
        if msg_count >= 5:
            send_alert(v_id, "DATA_BURST", "데이터 수신 폭주", f"{msg_count} req/s", v_timestamp)

        # 급가감속 (부호 포함 변화량)
        curr_speed = raw_data.get('speed', 0)
        speed_diff = curr_speed - state['last_speed']
        if speed_diff >= 50:
            send_alert(v_id, "SUDDEN_ACCEL", "급가속 감지", f"+{speed_diff} km/h", v_timestamp)
        elif speed_diff <= -50:
            send_alert(v_id, "SUDDEN_DECEL", "급감속 감지", f"{speed_diff} km/h", v_timestamp)

        # 연료 부족 (현재 잔량 %)
        fuel = raw_data.get('fuel_level', 100)
        if fuel < 5.0:
            send_alert(v_id, "LOW_FUEL", "연료 부족 경고", f"잔량 {fuel}%", v_timestamp)

        # GPS 도약 (변화 거리 도)
        curr_lat = raw_data.get('lat', 0)
        lat_diff = abs(curr_lat - state['last_lat'])
        if lat_diff > 1.0:
            send_alert(v_id, "ABNORMAL_GPS", "GPS 위치 급변", f"변동 {round(lat_diff, 2)}도", v_timestamp)

        # 상태 갱신 (다음 비교용)
        state['last_speed'] = curr_speed
        state['last_lat'] = curr_lat

        # --- 데이터 정제 및 전송 ---
        # 개인정보(driver_id) 삭제
        if 'driver_id' in raw_data:
            del raw_data['driver_id']

        # 비정상 노이즈 데이터 필터링
        if not (-90 <= curr_lat <= 90) or curr_speed < 0 or curr_speed > 300:
            print(f"노이즈 데이터 필터링됨 (v_id: {v_id})")
            continue
            
        # 정제 완료된 전체 데이터 전송 (cleansed_topic)
        producer.send(CLEANSED_TOPIC, key=original_key, value=raw_data)

except KeyboardInterrupt:
    print("사용자에 의해 프로세스가 중단되었습니다.")
finally:
    consumer.close()
    producer.close()
    print("Kafka 연결이 안전하게 종료되었습니다.")