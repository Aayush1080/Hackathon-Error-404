import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import ReportDetailsModal from './ReportDetailsModal';
import ConfirmActionModal from './ConfirmActionModal';
import { supabase, hasSupabase } from '../../lib/supabase';
import { fetchAllReports, approveReport, rejectReport, deleteReport, computeStats, usingMock } from '../../services/adminService';

const TITLES = { '/admin': 'Overview', '/admin/reports': 'Manage Reports', '/admin/map': 'Incident Map', '/admin/analytics': 'Analytics', '/admin/users': 'User Management', '/admin/settings': 'Settings' };

function Login({ onDone }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false); error ? setErr(error.message) : onDone();
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-[#14233a]">MoriSafe Admin</h1>
        <input className="w-full rounded-lg border p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border p-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [session, setSession] = useState(!hasSupabase), [checking, setChecking] = useState(hasSupabase);
  const [reports, setReports] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState(null), [action, setAction] = useState(null), [busy, setBusy] = useState(false), [toast, setToast] = useState(null);

  const checkSession = useCallback(async () => {
    if (!hasSupabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(!!data.session); setChecking(false);
  }, []);
  useEffect(() => { checkSession(); }, [checkSession]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReports(await fetchAllReports()); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  const notify = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 3500); };
  const ask = (type, report) => setAction({ type, report });

  async function confirm(reason) {
    if (busy) return; // prevents double submission
    setBusy(true);
    try {
      const { type, report } = action;
      if (type === 'approve') await approveReport(report.id);
      else if (type === 'reject') await rejectReport(report.id, reason);
      else await deleteReport(report.id);
      notify('ok', `Report ${type === 'delete' ? 'deleted' : type + 'd'}.`);
      setAction(null); setSelected(null); await load(); // stats recomputed from fresh data
    } catch (e) { notify('err', e.message); } finally { setBusy(false); }
  }
  async function logout() { if (hasSupabase) await supabase.auth.signOut(); setSession(!hasSupabase); }

  if (checking) return <div className="p-8">Loading…</div>;
  if (!session) return <Login onDone={checkSession} />;
  const stats = computeStats(reports);
  const current = reports.find((r) => r.id === selected?.id) || null;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar open={menu} onClose={() => setMenu(false)} onLogout={logout} />
      <div className="min-w-0 flex-1">
        <AdminNavbar title={TITLES[pathname] || 'Admin'} query={query} setQuery={setQuery} pending={stats.pending} onMenu={() => setMenu(true)} />
        {usingMock && <div className="bg-orange-50 px-4 py-2 text-xs text-orange-800">Demo mode: Supabase env vars not set, using in-memory mock data.</div>}
        <main className="space-y-4 p-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Database error: {error} <button className="underline" onClick={load}>Retry</button></div>}
          {loading && !reports.length ? <p className="text-slate-500">Loading reports…</p> : <Outlet context={{ reports, stats, query, view: setSelected, ask }} />}
        </main>
      </div>
      {current && <ReportDetailsModal report={current} onClose={() => setSelected(null)} ask={ask} />}
      {action && <ConfirmActionModal action={action} busy={busy} onConfirm={confirm} onClose={() => !busy && setAction(null)} />}
      {toast && <div className={`fixed bottom-4 right-4 z-[3000] rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.text}</div>}
    </div>
  );
}
