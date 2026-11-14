/* All communication with the MoriSafe API. Screens call these functions; nothing else uses fetch
   except map tiles and reverse geocoding. Errors are always ApiError with a user-readable message. */
import { solve } from './pow.js';

// VITE_API_URL set at build time wins (needed for the Android/iOS app). Otherwise a production build talks to
// the server it was loaded from (the deployed server serves this app too), and `npm run dev` to localhost:8000.
const BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');
const DEVICE_KEY = 'morisafe_device_id';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

/* A random id generated on first launch, used for notification choices and rate limits. The server
   only keeps an HMAC of it. */
export function deviceId() {
  let id = null;
  try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
  if (!id) {
    id = crypto.randomUUID();
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
  }
  return id;
}
export function resetDeviceId() {
  try { localStorage.removeItem(DEVICE_KEY); } catch (e) {}
}

/* The citizen's sign-in token (kept by main.js in encrypted device storage). */
let TOKEN = null;
export const setToken = (t) => { TOKEN = t || null; };
const headers = (extra = {}) => ({ 'X-Device-Id': deviceId(), ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), ...extra });

const OFFLINE = 'Cannot reach the MoriSafe server. Check your internet connection and try again.';

async function request(path, { method = 'GET', json, timeout = 20000, extra } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: headers({ ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra }),
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: ctl.signal,
    });
  } catch (e) {
    throw new ApiError(0, 'network_error', OFFLINE);
  } finally {
    clearTimeout(timer);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data && data.error) || {};
    throw new ApiError(res.status, e.code || 'http_' + res.status, e.message || `Server error (${res.status}). Try again.`, e.details);
  }
  return data;
}

/* Proof of work for sign-up, sign-in and reports ("X-Human-Proof" header). */
export async function humanProof(purpose) {
  const c = await request('/api/auth/challenge?purpose=' + purpose);
  return c.enabled ? solve(c.challenge, c.bits) : '';
}

export const listReports = (lang) => request('/api/reports' + (lang ? '?lang=' + encodeURIComponent(lang) : ''));
export const myReports = () => request('/api/reports/mine');
export const registerDevice = (body) => request('/api/devices', { method: 'PUT', json: body });
export const forgetDevice = () => request('/api/devices', { method: 'DELETE' });
export const sendFeedback = (id, stillThere) => request(`/api/reports/${id}/feedback`, { method: 'POST', json: { still_there: stillThere } });

export const register = (body, proof) => request('/api/auth/register', { method: 'POST', json: body, extra: { 'X-Human-Proof': proof } });
export const login = (body, proof) => request('/api/auth/login', { method: 'POST', json: body, extra: { 'X-Human-Proof': proof } });
export const me = () => request('/api/auth/me');

/* Multipart upload with progress. Resolves only once the server has saved the report and its photo. */
export function submitReport(fields, photo, proof, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    form.append('photo', photo, photo.name || (photo.type === 'image/jpeg' ? 'photo.jpg' : 'photo'));
    const x = new XMLHttpRequest();
    x.open('POST', BASE + '/api/reports');
    for (const [k, v] of Object.entries(headers(proof ? { 'X-Human-Proof': proof } : {}))) x.setRequestHeader(k, v);
    x.timeout = 120000;
    x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      let d = null;
      try { d = JSON.parse(x.responseText); } catch (e) {}
      if (x.status >= 200 && x.status < 300 && d && d.report) return resolve(d);
      const err = (d && d.error) || {};
      reject(new ApiError(x.status, err.code || 'http_' + x.status, err.message || `Server error (${x.status}). Try again.`, err.details));
    };
    x.onerror = () => reject(new ApiError(0, 'network_error', OFFLINE));
    x.ontimeout = () => reject(new ApiError(0, 'timeout', 'The upload took too long. Check your connection and try again.'));
    x.send(form);
  });
}
