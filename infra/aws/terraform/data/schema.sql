-- 계획 변경으로 전체 주석 처리 (추후 수정 예정)

/*
-- 차종 코드 테이블: 부모
CREATE TABLE IF NOT EXISTS model_codes (
    code          INT PRIMARY KEY,      -- 1, 2, 3, 4
    model_name    VARCHAR(50) NOT NULL, -- 차종
    image_url     TEXT                  -- S3 버킷 이미지 경로
);

INSERT INTO model_codes (code, model_name, image_url) VALUES
(1, 'Avante', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/avante.png'),
(2, 'Granduer', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/granduer.png'),
(3, 'Santafe', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/santafe.png'),
(4, 'Tucson', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/tucson.png')
ON CONFLICT (code) DO NOTHING;

-- 사용자 테이블: 자식
CREATE TABLE IF NOT EXISTS vehicle_master (
    id            SERIAL PRIMARY KEY,
    user_id       VARCHAR(50) NOT NULL,
    password      VARCHAR(255) NOT NULL,
    user_name     VARCHAR(100),
    vehicle_id    VARCHAR(50) UNIQUE,
    model_code    INT REFERENCES model_codes(code) -- 외래키 참조
);

INSERT INTO vehicle_master (user_id, password, user_name, vehicle_id, model_code) VALUES
('user01', 'pass01!', '강동훈', 'car_1', 1),
('user02', 'pass02!', '이정수', 'car_2', 2),
('user03', 'pass03!', '박서현', 'car_3', 3),
('user04', 'pass04!', '최윤지', 'car_4', 4)
ON CONFLICT (vehicle_id) DO NOTHING;

-- 차량 상태 테이블 (사용자 대시보드: 내 차 상태 / 운영자 대시보드: 전체 목록)
CREATE TABLE IF NOT EXISTS vehicle_stats (
    -- 식별자
    vehicle_id VARCHAR(50) PRIMARY KEY, -- vehicle_id
    
    -- 위치 및 주행 정보
    latitude NUMERIC(10, 7),            -- lat
    longitude NUMERIC(10, 7),           -- lon
    speed INT,                          -- speed
    fuel_level NUMERIC(5,2),            -- fuel
    
    -- 시동 및 상태
    engine_on BOOLEAN,                  -- engine_on
    mode INT,                           -- mode
    event_type INT                      -- event_type

    -- 시간 정보
    occurred_at TIMESTAMPTZ,            -- timestamp
    received_at TIMESTAMPTZ             -- server_timestamp
);

-- 이상 탐지 테이블 (운영자 대시보드: 이상 탐지)
CREATE TABLE IF NOT EXISTS vehicle_alerts (
    id SERIAL PRIMARY KEY,

    -- 식별자
    vehicle_id VARCHAR(50),

    -- 이상 종류
    alert_type VARCHAR(30) NOT NULL,

    -- 심각도 (WARNING, CRITICAL): 그라파나 색상 제어용
    alert_level VARCHAR(10) DEFAULT 'WARNING',

    -- 운영자에게 보여줄 상세 메시지
    alert_message TEXT,

    -- 주요 수치 (알람 발생 당시의 스냅샷)
    speed INT,                -- 급가속 / 급감속
    fuel_level NUMERIC(5,2),  -- 연료 소진
    latitude NUMERIC(10, 7),  -- 비정상 위치
    longitude NUMERIC(10, 7),

    -- 발생 / 수신 시각
    occurred_at TIMESTAMPTZ,  -- 급가속 / 급감속, 짧은 시간 내 과도한 알림 발생
    received_at TIMESTAMPTZ   -- 일정 시간 동안 데이터 미수신
);

-- 인덱스 추가 (대시보드 정렬 및 필터링)
CREATE INDEX idx_alerts_vehicle_time ON vehicle_alerts (vehicle_id, occurred_at DESC); -- 특정 차량의 최신 알람
CREATE INDEX idx_alerts_type ON vehicle_alerts (alert_type); -- 알람 종류별 필터링
*/