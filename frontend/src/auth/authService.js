const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const TOKEN_KEY = 'nw_auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    throw new Error(`Network error — unable to reach ${url}: ${networkError.message}`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${response.status})`);
  }

  if (!body.success) {
    throw new Error(body.message || `Request failed with HTTP ${response.status}`);
  }

  return body.data;
}

export const authService = {
  getToken,
  setToken,
  clearToken,

  async login(email, password) {
    const data = await authFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    return data.user;
  },

  async getCurrentUser() {
    if (!getToken()) return null;
    try {
      const data = await authFetch('/api/auth/me');
      return data;
    } catch (err) {
      // If the token is invalid or expired, clear it
      clearToken();
      throw err;
    }
  },

  async registerUser(email, password, role) {
    return authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
  }
};
