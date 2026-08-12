// Thin API client for the Mothsong backend.
//
// In production set VITE_API_BASE to the Render URL (e.g. https://mothsong-api.onrender.com).
// Locally, leave it blank and Vite proxies /api → http://localhost:4000.
//
// Auth token travels two ways: an httpOnly cookie (set by the server, sent because we
// use credentials:'include') AND an Authorization: Bearer header from the token we keep
// in localStorage. The header path is what makes cross-site auth robust even when a
// browser blocks third-party cookies.

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const withBase = (p) => `${BASE}${p}`;

let token = localStorage.getItem('ms_token') || null;

export function setToken(t) {
  token = t || null;
  if (t) localStorage.setItem('ms_token', t);
  else localStorage.removeItem('ms_token');
}
export function getToken() {
  return token;
}

async function request(path, { method = 'GET', body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // FormData; browser sets multipart boundary
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(withBase(path), {
    method,
    headers: h,
    body: payload,
    credentials: 'include',
  });

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),

  register: (username, password) =>
    request('/api/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  // Raw login lets the login screen pass arbitrary payloads (used by the CTF path).
  loginRaw: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  leaderboard: (limit = 25) => request(`/api/leaderboard?limit=${limit}`),
  submitScore: (score) => request('/api/leaderboard', { method: 'POST', body: score }),

  levels: () => request('/api/levels'),
  levelAsset: (name) => request(`/api/levels/asset?name=${encodeURIComponent(name)}`),

  avatarImport: (url) =>
    request('/api/profile/avatar-import', { method: 'POST', body: { url } }),

  uploadMod: (file) => {
    const form = new FormData();
    form.append('mod', file);
    return request('/api/mods/upload', { method: 'POST', form });
  },
  myMods: () => request('/api/mods/mine'),
};

export default api;
