import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ShieldCheck, UserPlus, Users, Trash2, KeyRound, ChevronRight, Info } from 'lucide-react';
import { fetchAdmins, addAdmin, setAdminRole, removeAdmin, fetchUsers, timeAgo } from '../services/adminService';
import { session } from '../lib/api';

const card = 'rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm';
const input = 'h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15';
const ROLE_TONE = { superadmin: 'bg-indigo-50 text-indigo-800', admin: 'bg-blue-50 text-blue-700', moderator: 'bg-emerald-50 text-emerald-700', viewer: 'bg-slate-100 text-slate-600' };

/* Settings: who can use this dashboard (administrators) and a way into the citizen accounts. */
export default function AdminSettings() {
  const { can, notify } = useOutletContext();
  const me = session.get()?.admin;
  const [data, setData] = useState(null), [err, setErr] = useState(''), [citizens, setCitizens] = useState(null);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'moderator' }), [busy, setBusy] = useState(''), [formErr, setFormErr] = useState('');
  const manage = can('users');

  const load = useCallback(async () => {
    try { setData(await fetchAdmins()); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); fetchUsers().then(setCitizens).catch(() => setCitizens([])); }, [load]);

  async function add(e) {
    e.preventDefault();
    setBusy('add'); setFormErr('');
    try {
      const r = await addAdmin({ ...form, full_name: form.full_name || null, password: form.password || null });
      notify('ok', r.new_sign_in ? `${r.admin.email} can now sign in to the dashboard with the password you set.` : `${r.admin.email} now has dashboard access with their existing password.`);
      setForm({ email: '', full_name: '', password: '', role: 'moderator' });
      await load();
    } catch (x) { setFormErr(x.message); } finally { setBusy(''); }
  }
  async function role(a, value) {
    setBusy(a.user_id);
    try { await setAdminRole(a.user_id, value); notify('ok', `${a.email} is now ${value}.`); await load(); } catch (x) { notify('err', x.message); } finally { setBusy(''); }
  }
  async function remove(a) {
    if (!window.confirm(`Remove dashboard access for ${a.email}? Their sign-in stays, but they can no longer open the dashboard.`)) return;
    setBusy(a.user_id);
    try { await removeAdmin(a.user_id); notify('ok', `${a.email} no longer has dashboard access.`); await load(); } catch (x) { notify('err', x.message); } finally { setBusy(''); }
  }

  const police = citizens?.filter((u) => u.role === 'police').length || 0, disabled = citizens?.filter((u) => u.disabled).length || 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Link to="/admin/users" className="flex items-center gap-3 rounded-2xl bg-[#0f1b2d] px-4 py-3.5 text-sm font-bold text-white xl:hidden">
          <Users size={18} /><span className="flex-1">Citizen accounts{citizens ? ` · ${citizens.length}` : ''}</span><ChevronRight size={18} /></Link>
        <section className={card}>
          <div className="mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><h2 className="text-[15.5px] font-extrabold">Administrators</h2>
            <span className="text-xs font-semibold text-slate-500">{data ? `${data.admins.length} with dashboard access` : ''}</span></div>
          <p className="mb-3 text-[12.5px] text-slate-500">People who can sign in to this dashboard. {manage ? 'Change a role or remove access below.' : 'Your role can view this list but not change it.'}</p>
          {err ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err} <button className="underline" onClick={load}>Retry</button></p> : !data ? <p className="py-4 text-sm text-slate-400">Loading…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">{['Person', 'Role', 'Last sign-in', ''].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {data.admins.map((a) => (
                    <tr key={a.user_id} className="border-b border-slate-50">
                      <td className="px-2.5 py-3"><div className="flex items-center gap-3">
                        <span className="brand-grad grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-extrabold text-white">{(a.full_name || a.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}</span>
                        <div><b className="block font-bold">{a.full_name || a.email}{a.you && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">You</span>}</b>{a.full_name && <span className="text-xs text-slate-500">{a.email}</span>}</div>
                      </div></td>
                      <td className="px-2.5 py-3">{manage && !a.you
                        ? <select disabled={busy === a.user_id} value={a.role} onChange={(e) => role(a, e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[13px] font-semibold capitalize">
                            {Object.keys(data.roles).map((r) => <option key={r} value={r}>{r}</option>)}</select>
                        : <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold capitalize ${ROLE_TONE[a.role] || ROLE_TONE.viewer}`}>{a.role}</span>}</td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-slate-500">{a.last_sign_in_at ? timeAgo(a.last_sign_in_at) : 'Never'}</td>
                      <td className="px-2.5 py-3 text-right">{manage && !a.you && <button disabled={busy === a.user_id} onClick={() => remove(a)} title="Remove dashboard access"
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} />Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {manage && (
          <section className={card}>
            <div className="mb-1 flex items-center gap-2"><UserPlus size={18} className="text-blue-600" /><h2 className="text-[15.5px] font-extrabold">Add an administrator</h2></div>
            <p className="mb-4 text-[12.5px] text-slate-500">Creates their dashboard sign-in. If the email already has a Supabase sign-in, it is reused and the password below is ignored.</p>
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Email<input className={`${input} mt-1`} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></label>
              <label className="text-xs font-bold text-slate-600">Full name<input className={`${input} mt-1`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Optional" /></label>
              <label className="text-xs font-bold text-slate-600">Password for a new sign-in<input className={`${input} mt-1`} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="10+ characters, letters and a number" /></label>
              <label className="text-xs font-bold text-slate-600">Role<select className={`${input} mt-1 capitalize`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.keys(data?.roles || { viewer: 1, moderator: 1, admin: 1 }).filter((r) => r !== 'superadmin' || me?.role === 'superadmin').map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              {formErr && <p className="text-sm font-semibold text-red-600 sm:col-span-2" role="alert">{formErr}</p>}
              <div className="sm:col-span-2"><button disabled={busy === 'add'} className="brand-grad h-11 rounded-xl px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 disabled:opacity-50">{busy === 'add' ? 'Adding…' : 'Add administrator'}</button></div>
            </form>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <section className={card}>
          <div className="mb-3 flex items-center gap-2"><Users size={18} className="text-blue-600" /><h2 className="text-[15.5px] font-extrabold">Citizen accounts</h2></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[citizens?.length, 'Accounts'], [police, 'Police'], [disabled, 'Disabled']].map(([n, l]) => (
              <div key={l} className="rounded-xl bg-slate-50 py-3"><b className="block text-2xl font-extrabold">{citizens === null ? '…' : n}</b><span className="text-[11.5px] font-semibold text-slate-500">{l}</span></div>
            ))}
          </div>
          <Link to="/admin/users" className="mt-3 flex items-center justify-between rounded-xl bg-[#0f1b2d] px-4 py-3 text-sm font-bold text-white">View and manage citizen accounts<ChevronRight size={18} /></Link>
          <p className="mt-2 text-[12px] text-slate-500">People who sign in to the app with their NID. You can disable or re-enable an account.</p>
        </section>
        <section className={card}>
          <div className="mb-2 flex items-center gap-2"><KeyRound size={18} className="text-blue-600" /><h2 className="text-[15.5px] font-extrabold">Your access</h2></div>
          <p className="text-sm"><b>{me?.email}</b></p>
          <p className="mt-1"><span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold capitalize ${ROLE_TONE[me?.role] || ROLE_TONE.viewer}`}>{me?.role}</span></p>
          <p className="mt-3 text-[12px] text-slate-500">Can: {(me?.permissions || []).join(', ')}.</p>
        </section>
        <section className={card}>
          <div className="mb-2 flex items-center gap-2"><Info size={18} className="text-blue-600" /><h2 className="text-[15.5px] font-extrabold">Roles</h2></div>
          <ul className="space-y-2 text-[12.5px]">
            {Object.entries(data?.roles || {}).map(([r, d]) => <li key={r} className="flex items-start gap-2"><span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize ${ROLE_TONE[r]}`}>{r}</span><span className="text-slate-600">{d}</span></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
