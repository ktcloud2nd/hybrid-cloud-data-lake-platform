const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || '요청을 처리하지 못했습니다.');
  }

  return data;
}

export async function login(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function signup(payload) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchModelCodes() {
  return request('/model-codes');
}
