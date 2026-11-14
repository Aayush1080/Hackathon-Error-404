import { useEffect, useRef } from 'react';
import { Menu, Search, Bell, RotateCw } from 'lucide-react';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const firstName = (a) => {
  const n = a?.full_name || (a?.email || '').split('@')[0].replace(/[._\d]+/g, ' ').trim();
  const f = (n.split(/\s+/)[0] || 'there');
  return f.charAt(0).toUpperCase() + f.slice(1);
};

export default function AdminNavbar({ title, home, query, setQuery, pending, onMenu, admin, synced, onRefresh }) {
  const box = useRef(null);
  useEffect(() => { // Ctrl/Cmd + K jumps to search
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.current?.focus(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-5 lg:px-7">
      <button className="rounded-xl border bg-white p-2 lg:hidden" onClick={onMenu} aria-label="Menu"><Menu size={20} /></button>
      <div className="mr-auto">
        <h1 className="text-[22px] font-extrabold tracking-tight">{home ? `${greet()}, ${firstName(admin)}` : title}</h1>
        <p className="text-[12.5px] text-slate-500">{date} · {pending ? `${pending} report${pending > 1 ? 's' : ''} waiting for review` : 'Nothing waiting for review'}</p>
      </div>
      <label className="relative order-last w-full sm:order-none sm:w-80">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input ref={box} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports, places, people"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-16 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15" />
        <kbd className="absolute right-2.5 top-2.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-sans text-[11px] text-slate-500">Ctrl K</kbd>
      </label>
      <button onClick={onRefresh} title={synced ? `Updated ${synced.toLocaleTimeString()} · refreshes every 30 s. Click to refresh now.` : 'Refresh'}
        className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.2)]" />Live<RotateCw size={12} className="ml-0.5 opacity-60" />
      </button>
      <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white" title={`${pending} waiting for review`}>
        <Bell size={18} />{pending > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />}
      </div>
    </header>
  );
}
