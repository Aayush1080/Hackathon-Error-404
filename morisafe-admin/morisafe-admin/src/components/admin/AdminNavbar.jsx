import { Menu, Search, Bell } from 'lucide-react';
export default function AdminNavbar({ title, query, setQuery, pending, onMenu }) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
      <button className="lg:hidden" onClick={onMenu} aria-label="Menu"><Menu /></button>
      <div className="mr-auto"><h1 className="text-xl font-bold text-[#14233a]">{title}</h1><p className="text-xs text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <div className="relative order-last w-full sm:order-none sm:w-64"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports…" className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm" /></div>
      <div className="relative" title={`${pending} pending`}><Bell className="text-slate-600" />{pending > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">{pending}</span>}</div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">AD</div>
    </header>
  );
}
