import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, Map, BarChart3, Users, Settings, LogOut, ShieldCheck, X } from 'lucide-react';

const MAIN = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/reports', 'Review queue', ClipboardCheck, false, 'pending'], ['/admin/map', 'Incident map', Map], ['/admin/analytics', 'Analytics', BarChart3]];
const MANAGE = [['/admin/users', 'Citizen accounts', Users], ['/admin/settings', 'Settings', Settings]];
const initials = (a) => (a?.full_name || a?.email || 'AD').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

export default function AdminSidebar({ open, onClose, onLogout, pending = 0, admin }) {
  const link = ([to, label, Icon, end, badge]) => (
    <NavLink key={to} to={to} end={end} onClick={onClose}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition ${isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#2dd4bf]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
      <Icon size={18} />{label}
      {badge && pending > 0 && <span className="ml-auto rounded-full bg-orange-500 px-2 text-[11px] font-bold text-white">{pending}</span>}
    </NavLink>
  );
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-[#0f1b2d] to-[#13284a] p-4 text-slate-300 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? '' : '-translate-x-full'}`}>
        <div className="mb-7 flex items-center gap-2.5 px-1.5 text-lg font-extrabold text-white">
          <span className="brand-grad grid h-9 w-9 place-items-center rounded-xl shadow-lg shadow-blue-900/40"><ShieldCheck size={19} /></span>MoriSafe
          <button className="ml-auto lg:hidden" onClick={onClose} aria-label="Close menu"><X /></button>
        </div>
        <nav className="flex-1 space-y-1">
          {MAIN.map(link)}
          <p className="px-3 pb-2 pt-5 text-[10.5px] font-bold uppercase tracking-widest text-slate-500">Manage</p>
          {MANAGE.map(link)}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-400 text-sm font-extrabold text-[#0f1b2d]">{initials(admin)}</span>
          <div className="min-w-0 flex-1"><b className="block truncate text-sm text-white">{admin?.full_name || admin?.email}</b><span className="text-[11px] capitalize text-slate-400">{admin?.role}</span></div>
          <button onClick={onLogout} title="Sign out" aria-label="Sign out" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><LogOut size={17} /></button>
        </div>
      </aside>
    </>
  );
}
