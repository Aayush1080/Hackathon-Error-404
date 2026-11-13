import { useMemo, useState } from 'react';
import { Eye, Check, Ban, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { severityOf } from '../../services/adminService';
const PER = 8;
const sel = 'rounded-lg border bg-white px-2 py-1.5 text-sm';
export default function ReportsTable({ reports, query = '', view, ask, defaultStatus = 'all' }) {
  const [cat, setCat] = useState('all'), [status, setStatus] = useState(defaultStatus), [dir, setDir] = useState('desc'), [page, setPage] = useState(1);
  const cats = useMemo(() => [...new Set(reports.map((r) => r.category))], [reports]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => (cat === 'all' || r.category === cat) && (status === 'all' || r.status === status) &&
        (!q || [r.id, r.title, r.category, r.location_name].some((v) => String(v).toLowerCase().includes(q))))
      .sort((a, b) => (dir === 'desc' ? 1 : -1) * (new Date(b.created_at) - new Date(a.created_at)));
  }, [reports, cat, status, dir, query]);
  const pages = Math.max(1, Math.ceil(rows.length / PER)), cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PER, cur * PER);
  const f = (set) => (e) => { set(e.target.value); setPage(1); };
  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <h2 className="mr-auto font-bold text-[#14233a]">Reports <span className="text-sm font-normal text-slate-400">({rows.length})</span></h2>
        <select className={sel} value={cat} onChange={f(setCat)} aria-label="Category"><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={status} onChange={f(setStatus)} aria-label="Status"><option value="all">All statuses</option><option>pending</option><option>approved</option><option>rejected</option></select>
        <button className={sel} onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>Date: {dir === 'desc' ? 'Newest' : 'Oldest'}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['ID', 'Incident', 'Category', 'Location', 'Submitted', 'Severity', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{String(r.id).slice(0, 8)}</td>
                <td className="px-4 py-2 font-medium">{r.title}</td>
                <td className="px-4 py-2">{r.category}</td>
                <td className="px-4 py-2">{r.location_name}</td>
                <td className="px-4 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge severity value={severityOf(r)} /></td>
                <td className="px-4 py-2"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-2"><div className="flex gap-1">
                  <button title="View" onClick={() => view(r)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50"><Eye size={16} /></button>
                  {r.status !== 'approved' && <button title="Approve" onClick={() => ask('approve', r)} className="rounded p-1.5 text-green-700 hover:bg-green-50"><Check size={16} /></button>}
                  {r.status !== 'rejected' && <button title="Reject" onClick={() => ask('reject', r)} className="rounded p-1.5 text-red-700 hover:bg-red-50"><Ban size={16} /></button>}
                  <button title="Delete" onClick={() => ask('delete', r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Trash2 size={16} /></button>
                </div></td>
              </tr>
            ))}
            {!slice.length && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No reports match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between p-3 text-sm">
        <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
        <span className="text-slate-500">Page {cur} / {pages}</span>
        <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
