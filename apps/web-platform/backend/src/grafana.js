function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

export function getGrafanaConfig() {
  const enabled = process.env.GRAFANA_ENABLED === 'true';
  const baseUrl = trimTrailingSlash(process.env.GRAFANA_BASE_URL || '');
  const embedUrl = process.env.GRAFANA_EMBED_URL || '';
  const provider = process.env.GRAFANA_PROVIDER || 'self-hosted';
  const allowEmbed = process.env.GRAFANA_ALLOW_EMBED === 'true';

  return {
    enabled,
    baseUrl,
    embedUrl,
    provider,
    allowEmbed
  };
}

export function getGrafanaEmbedPayload() {
  const config = getGrafanaConfig();

  return {
    enabled: config.enabled && config.allowEmbed && Boolean(config.embedUrl),
    provider: config.provider,
    embedUrl: config.embedUrl
  };
}
