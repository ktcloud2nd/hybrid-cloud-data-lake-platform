const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchGrafanaEmbed() {
  const response = await fetch(`${API_BASE_URL}/grafana/embed`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Grafana embed configuration could not be loaded.');
  }

  return data;
}
