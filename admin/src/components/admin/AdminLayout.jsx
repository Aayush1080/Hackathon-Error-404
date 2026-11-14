import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import ReportDetailsModal from './ReportDetailsModal';
import ConfirmActionModal from './ConfirmActionModal';
import { session, setOnExpired } from '../../lib/api';
import { login, logout, me, fetchAllReports, setStatus, deleteReport, updateReport, mergeReport, unmergeReport, computeStats } from '../../services/adminService';

const TITLES = { '/admin': 'Overview', '/admin/reports': 'Review queue', '/admin/map': 'Incident map', '/admin/analytics': 'Analytics', '/admin/users': 'Citizen Accounts', '/admin/settings': 'Settings' };
const STATUS_FOR = { approve: 'approved', reject: 'rejected', resolve: 'resolved', archive: 'archived', pending: 'pending' };
const DONE = { approve: 'approved and published', reject: 'rejected', resolve: 'resolved and removed', archive: 'archived', pending: 'moved back to pending', delete: 'deleted' };

function Login({ onDone, notice }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await login(email, password)); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(900px_500px_at_0%_0%,#d6f5ef,transparent_60%),radial-gradient(900px_600px_at_100%_100%,#dbe7ff,transparent_60%),#eef2f8] p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3.5 rounded-3xl border border-white bg-white p-7 shadow-2xl shadow-slate-900/10">
        <div className="mb-2 text-center">
          <span className="brand-grad mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-blue-600/30"><ShieldCheck size={28} /></span>
          <h1 className="text-2xl font-extrabold tracking-tight">MoriSafe admin</h1>
          <p className="text-sm text-slate-500">Review and publish hazard reports</p>
        </div>
        {notice && <p className="rounded-xl bg-orange-50 p-2.5 text-sm text-orange-800">{notice}</p>}
        <input className="h-12 w-full rounded-xl border border-slate-200 px-3.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" type="email" placeholder="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="h-12 w-full rounded-xl border border-slate-200 px-3.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm font-semibold text-red-600" role="alert">{err}</p>}
        <button disabled={busy} className="brand-grad h-12 w-full rounded-xl font-bold text-white shadow-lg shadow-blue-600/30 disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-xs text-slate-400">Administrator accounts are Supabase users listed in the admins table.</p>
      </form>
    </div>
  );
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [admin, setAdmin] = useState(null), [checking, setChecking] = useState(true), [notice, setNotice] = useState('');
  const [reports, setReports] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [synced, setSynced] = useState(null);
  const [query, setQuery] = useState(''), [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState(null), [action, setAction] = useState(null), [busy, setBusy] = useState(false), [toast, setToast] = useState(null);

  useEffect(() => {
    setOnExpired((msg) => { setAdmin(null); setNotice(msg || 'Your session expired. Sign in again.'); });
    if (!session.get()) { setChecking(false); return; }
    me().then((d) => setAdmin(d.admin)).catch(() => {}).finally(() => setChecking(false));
  }, []);

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    try { setReports(await fetchAllReports()); setError(''); setSynced(new Date()); }
    catch (e) { if (e.status !== 401) setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!admin) return undefined;
    load();
    const timer = setInterval(() => load(true), 30000); // new submissions appear without reloading
    return () => clearInterval(timer);
  }, [admin, load]);

  const notify = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 4000); };
  const ask = (type, report) => setAction({ type, report });
  const can = (perm) => !!admin?.permissions?.includes(perm);

  async function confirm(reason, checklist) {
    if (busy) return; // prevents double submission
    setBusy(true);
    const { type, report } = action;
    try {
      if (type === 'delete') { await deleteReport(report.id); setSelected(null); }
      else {
        await setStatus(report.id, STATUS_FOR[type], reason, type === 'approve' ? checklist : null);
        if (type === 'resolve') setSelected(null); // resolving deletes the incident
      }
      notify('ok', `Report ${DONE[type]}.`);
      setAction(null);
      await load(true);
    } catch (e) { notify('err', e.message); } finally { setBusy(false); }
  }
  async function save(id, patch) {
    const res = await updateReport(id, patch); // errors are shown inside the edit form
    notify('ok', res.changed ? 'Report updated.' : 'No changes to save.');
    await load(true);
  }
  async function merge(id, into) {
    try { await mergeReport(id, into); notify('ok', 'Reports merged into one incident.'); setSelected({ id: into }); await load(true); }
    catch (e) { notify('err', e.message); }
  }
  async function unmerge(id) {
    try { await unmergeReport(id); notify('ok', 'Report split out. It is now its own incident, waiting for review.'); await load(true); }
    catch (e) { notify('err', e.message); }
  }
  async function signOut() { await logout(); setAdmin(null); setReports([]); setNotice(''); }

  if (checking) return <div className="grid min-h-screen place-items-center text-slate-500">Checking your session…</div>;
  if (!admin) return <Login notice={notice} onDone={(a) => { setNotice(''); setAdmin(a); }} />;
  const stats = computeStats(reports);
  const current = reports.find((r) => r.id === selected?.id) || null;

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <AdminSidebar open={menu} onClose={() => setMenu(false)} onLogout={signOut} pending={stats.pending} admin={admin} />
      <div className="min-w-0 flex-1">
        <AdminNavbar title={TITLES[pathname] || 'Admin'} home={pathname === '/admin' || pathname === '/admin/'} query={query} setQuery={setQuery} pending={stats.pending}
          onMenu={() => setMenu(true)} admin={admin} synced={synced} onRefresh={() => load()} />
        <main className="space-y-4 px-5 pb-8 pt-3 lg:px-7">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error} <button className="underline" onClick={() => load()}>Retry</button></div>}
          {loading && !reports.length ? <p className="text-slate-500">Loading reports…</p> : <Outlet context={{ reports, stats, query, view: setSelected, ask, can, notify }} />}
        </main>
      </div>
      {current && <ReportDetailsModal report={current} reports={reports} onClose={() => !action && setSelected(null)} ask={ask} onSave={save} onMerge={merge} onUnmerge={unmerge} can={can} />}
      {action && <ConfirmActionModal action={action} busy={busy} onConfirm={confirm} onClose={() => !busy && setAction(null)} />}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-[3000] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.type === 'ok' ? 'bg-[#0f1b2d]' : 'bg-red-600'}`}>{toast.text}</div>}
    </div>
  );
}
