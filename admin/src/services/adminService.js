import { api, session } from '../lib/api';

export const CATEGORIES = ['Falling debris', 'Accident', 'Fire', 'Flooding', 'Other'];
export const TOWNS = ['Port Louis', 'Curepipe', 'Quatre Bornes', 'Vacoas-Phoenix', 'Rose Hill', 'Beau Bassin', 'Mahébourg', 'Flic en Flac',
  'Grand Baie', 'Triolet', 'Goodlands', 'Moka', 'Centre de Flacq', 'Saint Pierre', 'Souillac', 'Other'];
// "resolved" is not listed: resolving an incident deletes it.
export const STATUSES = ['pending', 'approved', 'rejected', 'archived'];
export const SOURCES = { citizen: 'Citizen', police: 'Police' };
// What a reviewer must confirm before publishing. The server checks the same keys (server/app/routes.py CHECKLIST).
export const CHECKLIST = [
  ['photo', 'The photo clearly shows the reported incident'],
  ['location', 'The map location matches the photo and description'],
  ['category', 'The incident type is correct'],
  ['content', 'No personal data, offensive or unrelated content is shown'],
  ['not_duplicate', 'It is not a duplicate of an incident already published'],
  ['current', 'The incident looks current (not old, staged or a joke)'],
];

export async function login(email, password) {
  const d = await api('/api/admin/login', { method: 'POST', body: { email, password }, auth: false });
  session.set(d);
  return d.admin;
}
export async function logout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* the session is cleared either way */ }
  session.clear();
}
export const me = () => api('/api/admin/me');
export const fetchAllReports = async () => (await api('/api/admin/reports')).reports;
export const fetchReport = (id) => api(`/api/admin/reports/${id}`);
export const updateReport = (id, patch) => api(`/api/admin/reports/${id}`, { method: 'PATCH', body: patch });
export const setStatus = (id, status, reason, checklist) =>
  api(`/api/admin/reports/${id}/status`, { method: 'PATCH', body: { status, reason: reason || null, checklist: checklist || null } });
export const deleteReport = (id) => api(`/api/admin/reports/${id}`, { method: 'DELETE' });
export const mergeReport = (id, into) => api(`/api/admin/reports/${id}/merge`, { method: 'POST', body: { into } });
export const unmergeReport = (id) => api(`/api/admin/reports/${id}/unmerge`, { method: 'POST' });
export const fetchUsers = async () => (await api('/api/admin/users')).users;
export const updateUser = (id, patch) => api(`/api/admin/users/${id}`, { method: 'PATCH', body: patch });

export const computeStats = (reports) => ({
  total: reports.length,
  ...Object.fromEntries(STATUSES.map((s) => [s, reports.filter((r) => r.status === s).length])),
  pending: reports.filter((r) => r.status === 'pending' || r.pending_duplicates).length,
});
export const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
export const inMauritius = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= -20.65 && lat <= -19.85 && lng >= 57.18 && lng <= 58.1;
export const distanceKm = (aLat, aLng, bLat, bLng) => {
  const r = Math.PI / 180, h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
// Esri street tiles: free, no key, and no referrer requirement (OpenStreetMap's own servers block app traffic).
export const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const TILE_OPTS = { maxZoom: 19, attribution: 'Tiles © Esri · Places © OpenStreetMap contributors' };
export const fetchAudit = async (limit = 10) => (await api(`/api/admin/audit?limit=${limit}`)).audit;
export const timeAgo = (d) => {
  const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const fetchAdmins = () => api('/api/admin/admins');
export const addAdmin = (body) => api('/api/admin/admins', { method: 'POST', body });
export const setAdminRole = (id, role) => api(`/api/admin/admins/${id}`, { method: 'PATCH', body: { role } });
export const removeAdmin = (id) => api(`/api/admin/admins/${id}`, { method: 'DELETE' });
