import {
  GenerateEmbedUrlForRegisteredUserCommand,
  QuickSightClient
} from '@aws-sdk/client-quicksight';

const region = process.env.AWS_REGION || process.env.QUICKSIGHT_AWS_REGION;

const quicksightClient = region
  ? new QuickSightClient({
      region
    })
  : null;

const EMBED_TARGETS = {
  anomaly: {
    title: 'Operator Anomaly Dashboard',
    dashboardIdEnvKey: 'QUICKSIGHT_ANOMALY_DASHBOARD_ID',
    registeredUserArnEnvKey: 'QUICKSIGHT_ANOMALY_REGISTERED_USER_ARN'
  },
  vehicle: {
    title: 'Operator Vehicle Dashboard',
    dashboardIdEnvKey: 'QUICKSIGHT_VEHICLE_DASHBOARD_ID',
    registeredUserArnEnvKey: 'QUICKSIGHT_VEHICLE_REGISTERED_USER_ARN'
  }
};

function getBaseConfig() {
  return {
    awsAccountId: process.env.QUICKSIGHT_AWS_ACCOUNT_ID,
    registeredUserArn: process.env.QUICKSIGHT_REGISTERED_USER_ARN,
    allowedDomains:
      process.env.QUICKSIGHT_ALLOWED_DOMAINS?.split(',')
        .map((domain) => domain.trim())
        .filter(Boolean) || ['http://localhost:5173'],
    sessionLifetimeInMinutes: Number(
      process.env.QUICKSIGHT_SESSION_LIFETIME_MINUTES || 60
    )
  };
}

function getDashboardConfig(target) {
  const targetConfig = EMBED_TARGETS[target];

  if (!targetConfig) {
    const error = new Error(`Unsupported QuickSight embed target: ${target}`);
    error.code = 'QUICKSIGHT_UNSUPPORTED_TARGET';
    throw error;
  }

  return {
    ...getBaseConfig(),
    target,
    title: targetConfig.title,
    dashboardId: process.env[targetConfig.dashboardIdEnvKey],
    dashboardIdEnvKey: targetConfig.dashboardIdEnvKey,
    registeredUserArn:
      process.env[targetConfig.registeredUserArnEnvKey] ||
      process.env.QUICKSIGHT_REGISTERED_USER_ARN,
    registeredUserArnEnvKey: targetConfig.registeredUserArnEnvKey
  };
}

function validateTargetConfig(target) {
  const config = getDashboardConfig(target);
  const missingFields = [];

  if (!region) missingFields.push('AWS_REGION');
  if (!config.awsAccountId) missingFields.push('QUICKSIGHT_AWS_ACCOUNT_ID');
  if (!config.registeredUserArn) {
    missingFields.push(
      `${config.registeredUserArnEnvKey} or QUICKSIGHT_REGISTERED_USER_ARN`
    );
  }
  if (!config.dashboardId) {
    missingFields.push(config.dashboardIdEnvKey);
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

async function buildDashboardEmbed(target) {
  const validation = validateTargetConfig(target);

  if (!validation.valid) {
    const error = new Error('QuickSight embedding configuration is incomplete.');
    error.code = 'QUICKSIGHT_CONFIG_MISSING';
    error.details = validation.missingFields;
    throw error;
  }

  if (!quicksightClient) {
    const error = new Error('QuickSight client is not initialized.');
    error.code = 'QUICKSIGHT_CLIENT_NOT_READY';
    throw error;
  }

  const config = getDashboardConfig(target);

  const command = new GenerateEmbedUrlForRegisteredUserCommand({
    AwsAccountId: config.awsAccountId,
    UserArn: config.registeredUserArn,
    AllowedDomains: config.allowedDomains,
    SessionLifetimeInMinutes: config.sessionLifetimeInMinutes,
    ExperienceConfiguration: {
      Dashboard: {
        InitialDashboardId: config.dashboardId
      }
    }
  });

  const result = await quicksightClient.send(command);

  return {
    dashboard: {
      title: config.title,
      embedUrl: result.EmbedUrl
    }
  };
}

export function validateQuickSightConfig(target) {
  return validateTargetConfig(target);
}

export function getEmbedDefinitions(target) {
  const config = getDashboardConfig(target);

  return [
    {
      key: 'dashboard',
      title: config.title
    }
  ];
}

export async function getAnomalyEmbedUrls() {
  return buildDashboardEmbed('anomaly');
}

export async function getVehicleEmbedUrls() {
  return buildDashboardEmbed('vehicle');
}
