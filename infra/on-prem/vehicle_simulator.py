import os
import sys
import json
import threading
import time
import random
import signal
from kafka import KafkaProducer

# ------------------------------------------
# [코드북 명세]
# 1. EVENT_TYPE: 데이터의 생성 성격
#    - 1: Telemetry (주행/상태 실시간 전송)
#    - 2: Heartbeat (엔진 OFF 시 생존 신고)
#
# 2. MODE: 차량의 물리적 상태
#    - 1: Driving (주행 중)
#    - 2: Stopped (시동 ON, 정차 중)
#    - 3: Off (시동 OFF)
# ------------------------------------------

# 환경 설정 및 카프카 연결
broker_ip = os.getenv('KAFKA_BROKER_IP')
if not broker_ip:
    print("에러: KAFKA_BROKER_IP 환경 변수가 설정되지 않았습니다.")
    sys.exit(1)

producer = KafkaProducer(
    bootstrap_servers=[f'{broker_ip}:9094'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    acks=1 
)

# 서울 인근 좌표 범위
LAT_MIN, LAT_MAX = 37.40, 37.70
LON_MIN, LON_MAX = 126.70, 127.20

#50대의 차량 초기 상태 생성
vehicles = [
    {
        "vehicle_id": f"car_{i+1}",
        "driver_id": f"driver_{i+1}",
        "lat": round(random.uniform(LAT_MIN, LAT_MAX), 6),
        "lon": round(random.uniform(LON_MIN, LON_MAX), 6),
        "speed": 0,
        "engine_on": True,
        "fuel_level": round(random.uniform(30, 100), 2)
    }
    for i in range(50)
]

def clamp(value, min_value, max_value):
    return max(min_value, min(value, max_value))

def send_to_kafka(vehicle, event_type, mode):
    """ 카프카로 데이터 전송 """
    payload = {
        "event_type": event_type,
        "mode": mode,
        "vehicle_id": vehicle["vehicle_id"],
        "driver_id": vehicle["driver_id"],
        "timestamp": int(time.time()), # AWS에서 표준 표기로 정제
        "lat": vehicle["lat"],
        "lon": vehicle["lon"],
        "speed": vehicle["speed"],
        "engine_on": vehicle["engine_on"],
        "fuel_level": round(vehicle["fuel_level"], 2)
    }
    # 차량 ID를 키로 지정하여 메시지 순서 보장
    producer.send("raw_topic", key=vehicle["vehicle_id"].encode('utf-8'), value=payload)

def simulate_vehicle(vehicle):
    """ 차량별 독립 스레드에서 실행되는 시뮬레이션 로직 """
    while True:
        roll = random.random()

        # 이상 데이터 발생 구간 (합계 10%)
        if roll < 0.05: # 미수신 (30초 잠수)
            time.sleep(30)
            continue
        elif roll < 0.08: # 폭주 (짧은 간격(1초 내) 5회 연속 전송)
            for _ in range(5):
                send_to_kafka(vehicle, 1, 1)
                time.sleep(0.1)
            continue
        elif roll < 0.10: # GPS 도약
            tmp_lat = vehicle["lat"]
            vehicle["lat"] += 1.2 # 약 130km 점프
            send_to_kafka(vehicle, 1, 1)
            vehicle["lat"] = tmp_lat # 전송 후 복구
            time.sleep(random.randint(2, 5))
            continue

        # 일반 주행 시뮬레이션 로직
        if random.random() < 0.15:
            vehicle["engine_on"] = not vehicle["engine_on"]
        
        if vehicle["engine_on"]:
            if random.random() < 0.7: # 주행 중 (Driving)
                vehicle["speed"] = random.randint(30, 100)
                vehicle["fuel_level"] = max(0, vehicle["fuel_level"] - random.uniform(0.1, 0.5))
                vehicle["lat"] += random.uniform(-0.001, 0.001) * (vehicle["speed"] / 50)
                vehicle["lon"] += random.uniform(-0.001, 0.001) * (vehicle["speed"] / 50)
                mode, event_type, interval = 1, 1, 1.0 # 1초 주기
            else: # 시동 ON, 정차 중 (Stopped)
                vehicle["speed"] = 0
                mode, event_type, interval = 2, 1, 5.0 # 5초 주기
        else: # 시동 OFF (Off)
            vehicle["speed"] = 0
            mode, event_type, interval = 3, 2, 30.0 # 30초 주기 (Heartbeat)

        # 좌표 제한 및 전송
        vehicle["lat"] = round(clamp(vehicle["lat"], 30.0, 45.0), 6)
        vehicle["lon"] = round(clamp(vehicle["lon"], 124.0, 132.0), 6)

        send_to_kafka(vehicle, event_type, mode)
        time.sleep(interval)

# 종료 시그널 처리
def graceful_shutdown(signum, frame):
    """시스템 종료 신호 수신 시 안전하게 자원 해제"""
    print(f"\n[알림] 종료 신호({signum}) 수신. 데이터 Flush 및 정리 중...")
    producer.flush()
    producer.close()
    print("시뮬레이터가 안전하게 종료되었습니다.")
    sys.exit(0)

# SIGTERM(도커 중지), SIGINT(Ctrl+C) 모두 대응
signal.signal(signal.SIGTERM, graceful_shutdown)
signal.signal(signal.SIGINT, graceful_shutdown)

# 메인 실행부
if __name__ == "__main__":
    print(f"차량 시뮬레이터 가동 시작 (Target: {broker_ip})")
    
    # 차량별 스레드 시작
    for v in vehicles:
        threading.Thread(target=simulate_vehicle, args=(v,), daemon=True).start()
    
    # 신호가 올 때까지 메인 스레드 대기 (CPU 점유율 0%)
    signal.pause()