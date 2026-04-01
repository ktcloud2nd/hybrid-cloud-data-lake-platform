import { query } from './db.js';

const defaultModelCodes = [
  { code: 1, modelName: 'Model 1', imageUrl: '' },
  { code: 2, modelName: 'Model 2', imageUrl: '' },
  { code: 3, modelName: 'Model 3', imageUrl: '' },
  { code: 4, modelName: 'Model 4', imageUrl: '' }
];

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS model_codes (
      code INT PRIMARY KEY,
      model_name VARCHAR(50) NOT NULL,
      image_url TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vehicle_master (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      user_name VARCHAR(100),
      vehicle_id VARCHAR(50) UNIQUE,
      model_code INT REFERENCES model_codes(code)
    );
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_master_vehicle_id_key'
      ) THEN
        ALTER TABLE vehicle_master
        ADD CONSTRAINT vehicle_master_vehicle_id_key UNIQUE (vehicle_id);
      END IF;
    END
    $$;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vehicle_anomaly_alerts (
      id BIGSERIAL PRIMARY KEY,
      vehicle_id VARCHAR(50) NOT NULL,
      anomaly_type VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      evidence VARCHAR(255),
      occurred_at BIGINT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_anomaly_alerts_occurred_at
    ON vehicle_anomaly_alerts (occurred_at DESC);
  `);

  for (const model of defaultModelCodes) {
    await query(
      `
        INSERT INTO model_codes (code, model_name, image_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE
        SET model_name = EXCLUDED.model_name,
            image_url = EXCLUDED.image_url;
      `,
      [model.code, model.modelName, model.imageUrl]
    );
  }
}
