const SUPPORTED_TARGETS = new Set(['all', 'user', 'operator']);

const requestedTarget = (import.meta.env.VITE_APP_TARGET || 'all').toLowerCase();

export const appTarget = SUPPORTED_TARGETS.has(requestedTarget)
  ? requestedTarget
  : 'all';

export const appUrls = {
  user: import.meta.env.VITE_USER_APP_URL || 'https://app.example.com',
  operator:
    import.meta.env.VITE_OPERATOR_APP_URL || 'https://admin.example.com'
};

export function getDefaultPathForRole(role) {
  return role === 'operator' ? appUrls.operator : appUrls.user;
}

export function getLoginUrl() {
  return '/login';
}

export function isExternalUrl(url) {
  const resolvedUrl = new URL(url, window.location.origin);
  return resolvedUrl.origin !== window.location.origin;
}
