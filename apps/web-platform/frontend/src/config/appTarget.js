const SUPPORTED_TARGETS = new Set(['all', 'login', 'user', 'operator']);

const requestedTarget = (import.meta.env.VITE_APP_TARGET || 'all').toLowerCase();

export const appTarget = SUPPORTED_TARGETS.has(requestedTarget)
  ? requestedTarget
  : 'all';

export const appUrls = {
  login: import.meta.env.VITE_LOGIN_APP_URL || '/login',
  user: import.meta.env.VITE_USER_APP_URL || '/user/dashboard',
  operator:
    import.meta.env.VITE_OPERATOR_APP_URL || '/operator/infra-service'
};

export function getDefaultPathForRole(role) {
  return role === 'operator' ? appUrls.operator : appUrls.user;
}

export function getLoginUrl() {
  return appUrls.login;
}

export function isExternalUrl(url) {
  const resolvedUrl = new URL(url, window.location.origin);
  return resolvedUrl.origin !== window.location.origin;
}
