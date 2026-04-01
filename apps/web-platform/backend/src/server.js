import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { query } from './db.js';
import { initSchema } from './initSchema.js';
import {
  getAnomalyEmbedUrls,
  getEmbedDefinitions,
  getVehicleEmbedUrls,
  validateQuickSightConfig
} from './quicksight.js';
// Ready for later enablement when deployment Grafana is finalized.
// import { getGrafanaEmbedPayload } from './grafana.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const appTarget = (process.env.APP_TARGET || 'all').toLowerCase();
const allowedOrigins =
  process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082'
  ];

function isEnabledForTarget(...targets) {
  return appTarget === 'all' || targets.includes(appTarget);
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

    const duplicateUser = await query(
      'SELECT id FROM vehicle_master WHERE user_id = $1',
      [userId]
    );

    if (duplicateUser.rowCount > 0) {
      response.status(409).json({
        code: 'DUPLICATE_USER_ID',
        message: 'That userId is already in use.'
      });
      return;
    }

    if (vehicleId) {
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
    }

    const result = await query(
      `
        INSERT INTO vehicle_master (user_id, password, user_name, vehicle_id, model_code)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id AS "userId", user_name AS "userName", vehicle_id AS "vehicleId", model_code AS "modelCode";
      `,
      [userId, password, userName, vehicleId || null, numericModelCode]
    );

    response.status(201).json({
      message: 'Sign up completed successfully.',
      user: result.rows[0]
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
        SELECT id, user_id AS "userId", user_name AS "userName", vehicle_id AS "vehicleId", model_code AS "modelCode"
        FROM vehicle_master
        WHERE user_id = $1 AND password = $2
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
      role: result.rows[0].modelCode === 0 ? 'operator' : 'user',
      user: result.rows[0]
    });
  });
}

if (isEnabledForTarget('operator')) {
  // Uncomment when operator Grafana embed should come from backend-managed env config
  // instead of the current local direct iframe URL in OperatorInfraServicePage.
  //
  // app.get('/api/grafana/embed', (_request, response) => {
  //   response.json(getGrafanaEmbedPayload());
  // });

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
