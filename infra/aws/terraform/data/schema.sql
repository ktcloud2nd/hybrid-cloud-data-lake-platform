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
*/

-- 정제 데이터 테이블 (기존과 동일, 호환 완료)
CREATE TABLE IF NOT EXISTS vehicle_stats (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    timestamp BIGINT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    speed INT,
    engine_on BOOLEAN,
    fuel_level NUMERIC(5, 2),
    event_type INT,
    mode INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicle_timestamp ON vehicle_stats(vehicle_id, timestamp DESC);

-- 이상 탐지 알람 테이블 (프로세서 코드의 'evidence' 필드와 호환되도록 수정)
CREATE TABLE IF NOT EXISTS vehicle_anomaly_alerts (
    id SERIAL PRIMARY KEY,
    alert_time BIGINT NOT NULL,       -- 서버 감지 시각 (alert_time)
    vehicle_id VARCHAR(50) NOT NULL,  -- 대상 차량 (vehicle_id)
    anomaly_type VARCHAR(100),        -- 이상 종류 (anomaly_type)
    description TEXT,                 -- 상황 제목 (description)
    evidence VARCHAR(255),            -- 핵심 수치 증거 (evidence)
    occurred_at BIGINT,               -- 실제 발생 시각 (occurred_at)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicle_timestamp ON vehicle_stats(vehicle_id, timestamp DESC);
CREATE INDEX idx_anomaly_type ON vehicle_anomaly_alerts(anomaly_type);