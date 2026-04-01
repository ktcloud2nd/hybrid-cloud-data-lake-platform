import pg from 'pg';

const { Pool } = pg;

function createPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL
    };
  }

  if (process.env.DB_HOST) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
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
