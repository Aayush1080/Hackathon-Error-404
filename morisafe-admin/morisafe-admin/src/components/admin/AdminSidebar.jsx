import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Map, BarChart3, Users, Settings, LogOut, ShieldAlert, X } from 'lucide-react';
const items = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/reports', 'Manage Reports', ClipboardList], ['/admin/map', 'Incident Map', Map], ['/admin/analytics', 'Analytics', BarChart3], ['/admin/users', 'User Management', Users], ['/admin/settings', 'Settings', Settings]];
export default function AdminSidebar({ open, onClose, onLogout }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#14233a] p-4 text-white transition-transform lg:static lg:translate-x-0 ${open ? '' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center gap-2 text-xl font-bold"><ShieldAlert className="text-blue-400" />MoriSafe<button className="ml-auto lg:hidden" onClick={onClose}><X /></button></div>
        <nav className="flex-1 space-y-1">
          {items.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-600' : 'text-slate-300 hover:bg-white/10'}`}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
        <button onClick={onLogout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut size={18} />Logout</button>
      </aside>
    </>
  );
}
