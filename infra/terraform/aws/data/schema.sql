CREATE TABLE vehicle_stats (
    vehicle_id VARCHAR(50) PRIMARY KEY,
    driver_code VARCHAR(50),
    timestamp TIMESTAMP,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    speed INT,
    engine_on BOOLEAN,
    fuel NUMERIC(5,2)
);

CREATE TABLE recent_alert (
    alert_id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50),
    driver_code VARCHAR(50),
    timestamp TIMESTAMP,
    alert_type VARCHAR(50),
    message TEXT
);

CREATE TABLE user_vehicle_mapping (
    driver_code VARCHAR(50),
    vehicle_id VARCHAR(50),
    PRIMARY KEY (driver_code, vehicle_id)
);