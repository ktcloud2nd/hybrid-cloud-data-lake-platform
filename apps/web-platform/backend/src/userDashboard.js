import { query } from './db.js';

const MODE_LABELS = {
  1: 'Driving',
  2: 'Stopped',
  3: 'Off'
};

function formatDateTime(epochSeconds) {
  if (!epochSeconds) return '-';

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .format(new Date(Number(epochSeconds) * 1000))
    .replace(',', '');
}

function formatTime(epochSeconds) {
  if (!epochSeconds) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(Number(epochSeconds) * 1000));
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function toCoordinatePair(row) {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    lat: latitude,
    lon: longitude
  };
}

function buildTripSummary(statsRows) {
  if (!statsRows.length) {
    return {
      distance: '0.0 km',
      duration: '0 min',
      averageSpeed: '0 km/h',
      destination: 'No recent destination'
    };
  }

  const rows = [...statsRows].sort(
    (a, b) => toNumber(a.timestamp) - toNumber(b.timestamp)
  );
  const validRows = rows.filter((row) => toCoordinatePair(row));
  let distanceKm = 0;

  for (let index = 1; index < validRows.length; index += 1) {
    const previous = toCoordinatePair(validRows[index - 1]);
    const current = toCoordinatePair(validRows[index]);

    distanceKm += haversineKm(
      previous.lat,
      previous.lon,
      current.lat,
      current.lon
    );
  }

  const durationMinutes =
    rows.length > 1
      ? Math.max(
          1,
          Math.round(
            (toNumber(rows[rows.length - 1].timestamp) -
              toNumber(rows[0].timestamp)) /
              60
          )
        )
      : 1;

  const averageSpeed = Math.round(
    rows.reduce((sum, row) => sum + toNumber(row.speed), 0) / rows.length
  );
  const latest = rows[rows.length - 1];

  return {
    distance: `${distanceKm.toFixed(1)} km`,
    duration: `${durationMinutes} min`,
    averageSpeed: `${averageSpeed} km/h`,
    destination: (() => {
      const latestCoordinates = toCoordinatePair(latest);
      return latestCoordinates
        ? `${latestCoordinates.lat.toFixed(4)}, ${latestCoordinates.lon.toFixed(4)}`
        : 'No recent destination';
    })()
  };
}

export async function loadUserDashboard(userId) {
  const accountResult = await query(
    `
      SELECT
        a.user_id AS "userId",
        a.user_name AS "userName",
        vm.vehicle_id AS "vehicleId",
        mc.model_name AS "modelName",
        mc.image_url AS "imageUrl"
      FROM accounts a
      JOIN user_vehicle_mapping uvm ON uvm.account_id = a.id
      JOIN vehicle_master vm ON vm.vehicle_id = uvm.vehicle_id
      LEFT JOIN model_codes mc ON mc.code = vm.model_code
      WHERE a.user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  if (accountResult.rowCount === 0) {
    return null;
  }

  const account = accountResult.rows[0];

  const latestStatsResult = await query(
    `
      SELECT vehicle_id, timestamp, lat, lon, speed, engine_on, fuel_level, event_type, mode
      FROM vehicle_stats
      WHERE vehicle_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `,
    [account.vehicleId]
  );

  const recentStatsResult = await query(
    `
      SELECT vehicle_id, timestamp, lat, lon, speed, engine_on, fuel_level, event_type, mode
      FROM vehicle_stats
      WHERE vehicle_id = $1
      ORDER BY timestamp DESC
      LIMIT 24
    `,
    [account.vehicleId]
  );

  const alertsResult = await query(
    `
      SELECT id, vehicle_id, anomaly_type, description, evidence, occurred_at
      FROM vehicle_anomaly_alerts
      WHERE vehicle_id = $1
      ORDER BY occurred_at DESC
      LIMIT 3
    `,
    [account.vehicleId]
  );

  const latest =
    latestStatsResult.rows[0] || {
      timestamp: Math.floor(Date.now() / 1000),
      lat: 37.5665,
      lon: 126.978,
      speed: 0,
      engine_on: false,
      fuel_level: 0,
      mode: 3
    };

  const lastUpdated = formatDateTime(latest.timestamp);
  const coordinates = `${toNumber(latest.lat).toFixed(4)}, ${toNumber(latest.lon).toFixed(4)}`;
  const online = Date.now() / 1000 - toNumber(latest.timestamp) <= 300;
  const tripSummary = buildTripSummary(recentStatsResult.rows);

  return {
    header: {
      imageUrl: account.imageUrl || '/models/grandeur.png',
      model: account.modelName || 'Vehicle',
      vehicleId: account.vehicleId,
      userName: account.userName || userId,
      connectionStatus: online ? 'Connected' : 'Signal delayed',
      lastUpdated
    },
    mainStatus: {
      ignition: latest.engine_on ? 'ON' : 'OFF',
      speed: `${Math.round(toNumber(latest.speed))} km/h`,
      fuel: `${Math.round(toNumber(latest.fuel_level))}%`,
      driveMode: MODE_LABELS[toNumber(latest.mode)] || 'Unknown'
    },
    summaryCards: [
      {
        label: 'Speed',
        value: `${Math.round(toNumber(latest.speed))} km/h`,
        description: 'Current vehicle speed'
      },
      {
        label: 'Fuel',
        value: `${Math.round(toNumber(latest.fuel_level))}%`,
        description: 'Remaining fuel level'
      },
      {
        label: 'Location',
        value: online ? 'Live' : 'Delayed',
        description: coordinates
      },
      {
        label: 'Last signal',
        value: formatTime(latest.timestamp),
        description: lastUpdated
      }
    ],
    map: {
      title: 'Vehicle location',
      status: online ? 'GPS Live' : 'Signal Delayed',
      coordinates,
      address: `Current vehicle coordinates (${coordinates})`
    },
    tripSummary,
    alerts: alertsResult.rows.map((alert) => ({
      id: alert.id,
      title: alert.anomaly_type || 'Vehicle alert',
      message:
        alert.description ||
        alert.evidence ||
        'A recent vehicle event was detected.',
      time: formatTime(alert.occurred_at)
    }))
  };
}
