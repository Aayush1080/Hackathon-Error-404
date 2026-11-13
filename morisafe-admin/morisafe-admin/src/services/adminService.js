import { supabase, hasSupabase } from '../lib/supabase';
import { makeMock } from './mockReports';

let mock = null;
const store = () => (mock ??= makeMock());
export const usingMock = !hasSupabase;

const run = async (q) => { const { data, error } = await q; if (error) throw error; return data; };
// RLS blocks silently (0 rows), so "no row changed" is treated as a permission error.
const mustChange = (rows) => {
  if (!rows || rows.length === 0) throw new Error('Not permitted or report not found. Check you are signed in as an admin (RLS).');
};

export async function fetchAllReports() {
  if (!hasSupabase) return [...store()];
  return run(supabase.from('reports').select('*').order('created_at', { ascending: false }));
}
export const fetchPendingReports = async () => (await fetchAllReports()).filter((r) => r.status === 'pending');
export async function fetchApprovedReports() {
  if (!hasSupabase) return store().filter((r) => r.status === 'approved');
  return run(supabase.from('reports').select('*').eq('status', 'approved').order('created_at', { ascending: false }));
}
async function setStatus(id, patch) {
  if (!hasSupabase) { const r = store().find((x) => x.id === id); mustChange(r ? [r] : []); Object.assign(r, patch); return; }
  mustChange(await run(supabase.from('reports').update(patch).eq('id', id).select('id')));
}
export const approveReport = (id) => setStatus(id, { status: 'approved', approved_at: new Date().toISOString(), rejection_reason: null });
export const rejectReport = (id, reason) => setStatus(id, { status: 'rejected', rejection_reason: reason });
export async function deleteReport(id) {
  if (!hasSupabase) { mock = store().filter((r) => r.id !== id); return; }
  mustChange(await run(supabase.from('reports').delete().eq('id', id).select('id')));
}
export const computeStats = (reports) => ({
  total: reports.length,
  pending: reports.filter((r) => r.status === 'pending').length,
  approved: reports.filter((r) => r.status === 'approved').length,
  rejected: reports.filter((r) => r.status === 'rejected').length,
});
// Severity is not a DB column: derived from category.
export const severityOf = (r) => (['Fire', 'Accident'].includes(r.category) ? 'High' : ['Flooding', 'Falling debris'].includes(r.category) ? 'Medium' : 'Low');
export const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
