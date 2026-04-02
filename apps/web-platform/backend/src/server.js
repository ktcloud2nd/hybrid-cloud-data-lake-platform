import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'crypto';
import { query, withTransaction } from './db.js';
import { initSchema } from './initSchema.js';
import {
  getAnomalyEmbedUrls,
  getEmbedDefinitions,
  getVehicleEmbedUrls,
  validateQuickSightConfig
} from './quicksight.js';
import { getGrafanaEmbedPayload } from './grafana.js';
import { loadUserDashboard } from './userDashboard.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const appTarget = (process.env.APP_TARGET || 'all').toLowerCase();
const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS || 60 * 60);
const allowedOrigins =
  process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082'
  ];

function isEnabledForTarget(...targets) {
  return appTarget === 'all' || targets.includes(appTarget);
}

function encodeTokenPart(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeTokenPart(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createSessionToken(account) {
  const payload = {
    userId: account.userId,
    role: account.role,
    issuedAt: Math.floor(Date.now() / 1000)
  };
  const encodedPayload = encodeTokenPart(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', String(account.passwordHash))
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(authorizationHeader) {
  const bearerPrefix = 'Bearer ';
  const headerValue = String(authorizationHeader || '');

  if (!headerValue.startsWith(bearerPrefix)) {
    return null;
  }

  const token = headerValue.slice(bearerPrefix.length).trim();
  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(decodeTokenPart(encodedPayload));
  } catch {
    return null;
  }

  if (!payload?.userId || !payload?.role || !Number.isInteger(payload.issuedAt)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    payload.issuedAt > now ||
    now - payload.issuedAt > sessionTtlSeconds
  ) {
    return null;
  }

  const accountResult = await query(
    `
      SELECT
        user_id AS "userId",
        role,
        password_hash AS "passwordHash"
      FROM accounts
      WHERE user_id = $1
      LIMIT 1
    `,
    [payload.userId]
  );

  if (accountResult.rowCount === 0) {
    return null;
  }

  const account = accountResult.rows[0];
  const expectedSignature = crypto
    .createHmac('sha256', String(account.passwordHash))
    .update(encodedPayload)
    .digest();
  const actualSignature = Buffer.from(providedSignature, 'base64url');

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  if (account.role !== payload.role) {
    return null;
  }

  return {
    userId: account.userId,
    role: account.role
  };
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    }
  })
);
app.use(express.json());

function handleQuickSightError(response, error, target) {
  if (error.code === 'QUICKSIGHT_CONFIG_MISSING') {
    response.status(503).json({
      message: `QuickSight ${target} embedding configuration is incomplete.`,
      missingFields: error.details,
      panels: getEmbedDefinitions(target)
    });
    return;
  }

  response.status(500).json({
    message: `Failed to generate QuickSight ${target} embed URLs.`,
    details: error.message
  });
}

app.get('/api/health', async (_request, response) => {
  const result = await query('SELECT NOW() AS now');
  response.json({ ok: true, now: result.rows[0].now, appTarget });
});

if (isEnabledForTarget('login')) {
  app.get('/api/model-codes', async (_request, response) => {
    const result = await query(
      'SELECT code, model_name AS "modelName", image_url AS "imageUrl" FROM model_codes ORDER BY code ASC'
    );
    response.json(result.rows);
  });

  app.post('/api/auth/signup', async (request, response) => {
    const { userId, password, userName, vehicleId, modelCode } = request.body;

    if (!userId || !password || !userName || !modelCode) {
      response.status(400).json({
        message: 'userId, password, userName, and modelCode are required.'
      });
      return;
    }

    const numericModelCode = Number(modelCode);

    if (![1, 2, 3, 4].includes(numericModelCode)) {
      response.status(400).json({
        message: 'modelCode must be one of 1, 2, 3, or 4.'
      });
      return;
    }

    if (!vehicleId) {
      response.status(400).json({
        message: 'vehicleId is required.'
      });
      return;
    }

    const duplicateUser = await query(
      'SELECT id FROM accounts WHERE user_id = $1',
      [userId]
    );

    if (duplicateUser.rowCount > 0) {
      response.status(409).json({
        code: 'DUPLICATE_USER_ID',
        message: 'That userId is already in use.'
      });
      return;
    }

    const duplicateVehicle = await query(
      'SELECT id FROM vehicle_master WHERE vehicle_id = $1',
      [vehicleId]
    );

    if (duplicateVehicle.rowCount > 0) {
      response.status(409).json({
        code: 'DUPLICATE_VEHICLE_ID',
        message: 'That vehicleId is already in use.'
      });
      return;
    }

    const createdUser = await withTransaction(async (client) => {
      const accountResult = await client.query(
        `
          INSERT INTO accounts (user_id, password_hash, role, user_name)
          VALUES ($1, $2, 'user', $3)
          RETURNING id, user_id AS "userId", user_name AS "userName", role, password_hash AS "passwordHash";
        `,
        [userId, password, userName]
      );

      await client.query(
        `
          INSERT INTO vehicle_master (vehicle_id, model_code)
          VALUES ($1, $2)
        `,
        [vehicleId, numericModelCode]
      );

      await client.query(
        `
          INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
          VALUES ($1, $2)
        `,
        [accountResult.rows[0].id, vehicleId]
      );

      const userResult = await client.query(
        `
          SELECT
            a.id,
            a.user_id AS "userId",
            a.user_name AS "userName",
            a.role,
            v.vehicle_id AS "vehicleId",
            v.model_code AS "modelCode"
          FROM accounts a
          LEFT JOIN user_vehicle_mapping uvm ON uvm.account_id = a.id
          LEFT JOIN vehicle_master v ON v.vehicle_id = uvm.vehicle_id
          WHERE a.id = $1
        `,
        [accountResult.rows[0].id]
      );

      return userResult.rows[0];
    });

    response.status(201).json({
      message: 'Sign up completed successfully.',
      user: createdUser
    });
  });

  app.post('/api/auth/login', async (request, response) => {
    const { userId, password } = request.body;

    if (!userId || !password) {
      response.status(400).json({
        message: 'userId and password are required.'
      });
      return;
    }

    const result = await query(
      `
        SELECT
          a.id,
          a.user_id AS "userId",
          a.user_name AS "userName",
          a.role,
          a.password_hash AS "passwordHash",
          v.vehicle_id AS "vehicleId",
          v.model_code AS "modelCode"
        FROM accounts a
        LEFT JOIN user_vehicle_mapping uvm
          ON uvm.account_id = a.id
          AND a.role = 'user'
        LEFT JOIN vehicle_master v ON v.vehicle_id = uvm.vehicle_id
        WHERE a.user_id = $1 AND a.password_hash = $2
      `,
      [userId, password]
    );

    if (result.rowCount === 0) {
      response.status(401).json({
        message: 'Invalid userId or password.'
      });
      return;
    }

    response.json({
      role: result.rows[0].role,
      token: createSessionToken(result.rows[0]),
      user: {
        ...result.rows[0],
        passwordHash: undefined
      }
    });
  });
}

if (isEnabledForTarget('operator')) {
  app.get('/api/grafana/embed', (_request, response) => {
    response.json(getGrafanaEmbedPayload());
  });

  app.get('/api/anomalies/latest-alert', async (_request, response) => {
    try {
      const result = await query(
        `
          SELECT
            vehicle_id AS "vehicleId",
            anomaly_type AS "anomalyType",
            description,
            evidence,
            TO_CHAR(TO_TIMESTAMP(occurred_at), 'YYYY-MM-DD HH24:MI:SS') AS "occurredAtDt"
          FROM vehicle_anomaly_alerts
          ORDER BY occurred_at DESC
          LIMIT 1
        `
      );

      response.json({
        alert: result.rows[0] || null
      });
    } catch (error) {
      response.status(500).json({
        message: 'Failed to load the latest anomaly alert.',
        details: error.message
      });
    }
  });

  app.get('/api/quicksight/anomaly-embeds', async (_request, response) => {
    try {
      const embeds = await getAnomalyEmbedUrls();
      response.json({
        panels: embeds
      });
    } catch (error) {
      handleQuickSightError(response, error, 'anomaly');
    }
  });

  app.get('/api/quicksight/vehicle-embeds', async (_request, response) => {
    try {
      const embeds = await getVehicleEmbedUrls();
      response.json({
        panels: embeds
      });
    } catch (error) {
      handleQuickSightError(response, error, 'vehicle');
    }
  });

  app.get('/api/quicksight/anomaly-embeds/status', (_request, response) => {
    const validation = validateQuickSightConfig('anomaly');
    response.json(validation);
  });

  app.get('/api/quicksight/vehicle-embeds/status', (_request, response) => {
    const validation = validateQuickSightConfig('vehicle');
    response.json(validation);
  });
}

if (isEnabledForTarget('user')) {
  app.get('/api/user/dashboard', async (request, response) => {
    const session = await verifySessionToken(request.header('authorization'));

    if (!session || session.role !== 'user') {
      response.status(401).json({
        message: 'A valid authenticated user session is required.'
      });
      return;
    }

    try {
      const dashboard = await loadUserDashboard(session.userId);

      if (!dashboard) {
        response.status(404).json({
          message: 'User dashboard data could not be found.'
        });
        return;
      }

      response.json(dashboard);
    } catch (error) {
      response.status(500).json({
        message: 'User dashboard could not be loaded.',
        details: error.message
      });
    }
  });
}

async function startServer() {
  await initSchema();

  app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port} (target: ${appTarget})`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend server', error);
  process.exit(1);
});
