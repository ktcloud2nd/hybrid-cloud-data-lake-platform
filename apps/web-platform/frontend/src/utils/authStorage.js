const STORAGE_KEY = 'web-platform-session';

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function decodeBase64(value) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function getStoredSession() {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function setStoredSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function encodeSession(session) {
  return encodeBase64(JSON.stringify(session));
}

export function decodeSession(serializedSession) {
  return JSON.parse(decodeBase64(serializedSession));
}

export function consumeSessionFromUrl() {
  const currentUrl = new URL(window.location.href);
  const serializedSession = currentUrl.searchParams.get('session');

  if (!serializedSession) {
    return null;
  }

  try {
    const session = decodeSession(serializedSession);
    setStoredSession(session);
    currentUrl.searchParams.delete('session');
    window.history.replaceState({}, '', currentUrl);
    return session;
  } catch {
    currentUrl.searchParams.delete('session');
    window.history.replaceState({}, '', currentUrl);
    return null;
  }
}
