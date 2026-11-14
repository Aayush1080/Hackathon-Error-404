// Single place where the dashboard talks to the MoriSafe API. The session token lives in sessionStorage
// (cleared when the tab closes). Every admin request is checked by the server; hiding a button is only UX.
// Unset in a production build = same server that served the dashboard (the deployed server serves it at /admin).
const BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');
const KEY = 'morisafe_admin_session';

export const session = {
  get() {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY));
      return s && s.expires_at * 1000 > Date.now() ? s : null;
    } catch {
      return null;
    }
  },
  set(s) { sessionStorage.setItem(KEY, JSON.stringify(s)); },
  clear() { sessionStorage.removeItem(KEY); },
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

let onExpired = () => {};
export const setOnExpired = (fn) => { onExpired = fn; };

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const s = session.get();
  if (auth && s) headers.Authorization = `Bearer ${s.token}`;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'network_error', `Cannot reach the MoriSafe server at ${BASE}. Check that it is running.`);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && auth) {
      session.clear();
      onExpired(e.message);
    }
    throw new ApiError(res.status, e.code || `http_${res.status}`, e.message || `Request failed (${res.status}).`, e.details);
  }
  return data;
}
