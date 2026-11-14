import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { fetchUsers, updateUser } from '../services/adminService';

/* Citizen accounts (NID sign-in). Admins can disable or re-enable an account. The role (citizen or police)
   cannot be changed here. NIDs are only ever shown masked. */
export default function AdminUsers() {
  const { query, can, notify } = useOutletContext();
  const [users, setUsers] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(null), [role, setRole] = useState('all');
  const load = useCallback(async () => {
    try { setUsers(await fetchUsers()); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) => (role === 'all' || u.role === role) && (!q || [u.full_name, u.nid_masked, u.phone].some((v) => String(v ?? '').toLowerCase().includes(q))));
  }, [users, query, role]);

  async function change(u, patch, msg) {
    setBusy(u.id);
    try { await updateUser(u.id, patch); notify('ok', msg); await load(); } catch (e) { notify('err', e.message); } finally { setBusy(null); }
  }
  const canEdit = can('users');
  if (err) return <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{err} <button className="underline" onClick={load}>Retry</button></div>;
  if (!users) return <p className="text-slate-500">Loading accounts…</p>;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <h2 className="mr-auto font-bold font-extrabold">Citizen accounts <span className="text-sm font-normal text-slate-400">({rows.length})</span></h2>
        <select className="rounded-lg border bg-white px-2 py-1.5 text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="all">All accounts</option><option value="citizen">Citizens</option><option value="police">Police</option>
        </select>
      </div>
      <p className="px-4 pb-2 text-xs text-slate-500">People sign in to the app with their NID. Passwords are stored as salted scrypt hashes and NIDs as keyed hashes, so neither can be read here.{!canEdit && ' Your role can view accounts but not change them.'}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Name', 'NID', 'Phone', 'Role', 'Reports', 'Joined', 'Last sign-in', ''].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={`border-t ${u.disabled ? 'bg-slate-50 text-slate-400' : ''}`}>
                <td className="px-4 py-2 font-medium">{u.full_name}{u.disabled && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs text-slate-600">disabled</span>}</td>
                <td className="px-4 py-2 font-mono text-xs">{u.nid_masked}</td>
                <td className="px-4 py-2">{u.phone || '—'}</td>
                <td className="px-4 py-2">{u.role === 'police'
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-900 px-2 py-0.5 text-xs font-semibold text-white"><ShieldCheck size={12} />Police</span>
                  : <span className="text-xs">Citizen</span>}</td>
                <td className="px-4 py-2">{u.reports}</td>
                <td className="px-4 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                <td className="px-4 py-2">{canEdit && <div className="flex justify-end gap-1">
                  <button disabled={busy === u.id} title={u.disabled ? 'Enable' : 'Disable'} onClick={() => change(u, { disabled: !u.disabled }, u.disabled ? 'Account enabled.' : 'Account disabled. It can no longer sign in or send reports.')}
                    className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-50 ${u.disabled ? '' : 'border-red-200 text-red-700'}`}>{u.disabled ? <UserCheck size={14} /> : <UserX size={14} />}</button>
                </div>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No accounts yet. People create one in the app with their NID.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
