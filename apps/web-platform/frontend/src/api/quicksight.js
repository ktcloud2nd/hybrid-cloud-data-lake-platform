const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, defaultMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || defaultMessage);
    error.missingFields = data.missingFields || [];
    error.panels = data.panels || [];
    throw error;
  }

  return data;
}

export async function fetchAnomalyEmbeds() {
  return request(
    '/quicksight/anomaly-embeds',
    'QuickSight anomaly embeds could not be loaded.'
  );
}

export async function fetchVehicleEmbeds() {
  return request(
    '/quicksight/vehicle-embeds',
    'QuickSight vehicle embeds could not be loaded.'
  );
}

export async function fetchLatestAnomalyAlert() {
  return request(
    '/anomalies/latest-alert',
    'The latest anomaly alert could not be loaded.'
  );
}
