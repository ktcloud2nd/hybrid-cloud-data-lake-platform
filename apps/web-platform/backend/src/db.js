import pg from 'pg';

const { Pool } = pg;

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function createSslConfig() {
  const sslMode = (
    process.env.DB_SSL_MODE ||
    process.env.PGSSLMODE ||
    ''
  ).toLowerCase();
  const sslEnabled = isTruthy(process.env.DB_SSL) || Boolean(sslMode);

  if (!sslEnabled) {
    return undefined;
  }

  if (sslMode === 'no-verify') {
    return {
      rejectUnauthorized: false
    };
  }

  if (sslMode === 'require') {
    return {
      rejectUnauthorized: true
    };
  }

  return {
    rejectUnauthorized: !['false', '0', 'no', 'off'].includes(
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase()
    )
  };
}

function createPoolConfig() {
  const ssl = createSslConfig();

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...(ssl ? { ssl } : {})
    };
  }

  if (process.env.DB_HOST) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...(ssl ? { ssl } : { ssl: { rejectUnauthorized: false } })
    };
  }

  return {};
}

const pool = new Pool(createPoolConfig());

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
