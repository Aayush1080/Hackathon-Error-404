import { useMemo, useState } from 'react';
import { Layers, ShieldCheck, ThumbsDown, ThumbsUp, Check } from 'lucide-react';
import { catTile } from '../../lib/icons';
import { STATUSES, timeAgo } from '../../services/adminService';

const PER = 8;
const sel = 'h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-600';
const Tile = ({ category }) => <span className="inline-flex" dangerouslySetInnerHTML={{ __html: catTile(category, 40) }} />;
const STATUS = { pending: ['bg-orange-50 text-orange-700', 'Pending'], approved: ['bg-emerald-50 text-emerald-700', 'Live'], rejected: ['bg-red-50 text-red-700', 'Rejected'], archived: ['bg-slate-100 text-slate-600', 'Archived'], resolved: ['bg-blue-50 text-blue-700', 'Resolved'] };
export const StatusPill = ({ value }) => {
  const [c, l] = STATUS[value] || ['bg-slate-100 text-slate-600', value];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ${c}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{l}</span>;
};

/* One row per incident: reports of the same emergency are merged (see "Signals"). */
export default function ReportsTable({ reports, query = '', view, ask, can = () => true, defaultStatus = 'all', title = 'Incidents', compact = false }) {
  const [cat, setCat] = useState('all'), [status, setStatus] = useState(defaultStatus), [src, setSrc] = useState('all');
  const [dir, setDir] = useState('desc'), [page, setPage] = useState(1);
  const cats = useMemo(() => [...new Set(reports.map((r) => r.category))], [reports]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => (cat === 'all' || r.category === cat) && (src === 'all' || r.source === src) &&
        (status === 'all' || r.status === status || (status === 'pending' && r.pending_duplicates > 0)) &&
        (!q || [r.id, r.title, r.label, r.town, r.location_name, r.description, r.reporter?.name].some((v) => String(v ?? '').toLowerCase().includes(q))))
      .sort((a, b) => (dir === 'desc' ? 1 : -1) * (new Date(b.created_at) - new Date(a.created_at)));
  }, [reports, cat, status, src, dir, query]);
  const per = compact ? 6 : PER;
  const pages = Math.max(1, Math.ceil(rows.length / per)), cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * per, cur * per);
  const f = (set) => (e) => { set(e.target.value); setPage(1); };
  const reportCount = rows.reduce((n, r) => n + 1 + (r.duplicates?.length || 0), 0);
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15.5px] font-extrabold">{title}</h2>
        <span className="mr-auto text-xs font-semibold text-slate-500">{rows.length} incident{rows.length === 1 ? '' : 's'} · {reportCount} report{reportCount === 1 ? '' : 's'}</span>
        <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Reported by">
          {[['all', 'All'], ['citizen', 'Citizen'], ['police', 'Police']].map(([v, l]) => (
            <button key={v} onClick={() => { setSrc(v); setPage(1); }} aria-pressed={src === v}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${src === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {!compact && <>
          <select className={sel} value={cat} onChange={f(setCat)} aria-label="Category"><option value="all">All types</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <button className={sel} onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>{dir === 'desc' ? 'Newest first' : 'Oldest first'}</button>
        </>}
        <select className={sel} value={status} onChange={f(setStatus)} aria-label="Status"><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]?.[1] || s}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full ${compact ? "min-w-[600px]" : "min-w-[760px]"} text-left text-[13px]`}>
          <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">{['Incident', 'Reporter', 'Signals', ...(compact ? [] : ['Received']), 'Status', ''].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((r, i) => {
              const fb = r.feedback || {}, gone = fb.gone > 0 && fb.gone >= (fb.still_there || 0);
              const resolve = r.status === 'approved' && gone && can('review');
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                  <td className="px-2.5 py-2.5"><button onClick={() => view(r)} className="flex items-center gap-3 text-left">
                    <Tile category={r.category} />
                    <span><b className="block text-[13.5px] font-bold">{r.label}</b><span className={`block truncate text-xs text-slate-500 ${compact ? "max-w-[160px] xl:max-w-[150px] 2xl:max-w-[240px]" : "max-w-[260px]"}`}>{r.location_name}</span>{compact && <span className="block text-[11px] text-slate-400">{timeAgo(r.created_at)}</span>}</span>
                  </button></td>
                  <td className="px-2.5 py-2.5">
                    {r.source === 'police'
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11.5px] font-bold text-indigo-900"><ShieldCheck size={12} />Police</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700"><Check size={12} />Citizen</span>}
                    <span className="mt-1 block text-[11.5px] text-slate-500">{r.reporter?.name || (r.reporter_ref ? 'Anonymous device' : 'Anonymous')}</span>
                  </td>
                  <td className="px-2.5 py-2.5"><div className="flex flex-col items-start gap-1">
                    {r.duplicates?.length > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-1 text-[11.5px] font-bold text-violet-700"><Layers size={12} />{r.duplicates.length + 1} reports merged{r.pending_duplicates ? ` · ${r.pending_duplicates} new` : ''}</span>}
                    {fb.gone > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-bold text-amber-800"><ThumbsDown size={12} />{fb.gone} say it's gone</span>}
                    {fb.still_there > 0 && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-[11.5px] font-bold text-sky-800"><ThumbsUp size={12} />{fb.still_there} still there</span>}
                    {!r.duplicates?.length && !fb.gone && !fb.still_there && <span className="text-slate-300">—</span>}
                  </div></td>
                  {!compact && <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600" title={new Date(r.created_at).toLocaleString()}>{timeAgo(r.created_at)}</td>}
                  <td className="px-2.5 py-2.5"><StatusPill value={r.status} /></td>
                  <td className="px-2.5 py-2.5 text-right">
                    {resolve
                      ? <button onClick={() => ask('resolve', r)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">Resolve</button>
                      : <button onClick={() => view(r)} className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${r.status === 'pending' && i === 0 ? 'bg-[#0f1b2d] text-white' : 'border border-slate-200 hover:bg-slate-50'}`}>{r.status === 'pending' || r.pending_duplicates ? 'Review' : 'Open'}</button>}
                  </td>
                </tr>
              );
            })}
            {!slice.length && <tr><td colSpan={compact ? 5 : 6} className="p-10 text-center text-slate-400">{status === 'pending' ? 'All caught up: nothing is waiting for review.' : 'No reports match.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="mt-3 flex items-center justify-between text-sm">
        <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-xl border px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
        <span className="text-slate-500">Page {cur} of {pages}</span>
        <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-xl border px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
      </div>}
    </div>
  );
}
