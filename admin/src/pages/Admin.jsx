import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Hourglass, Radio, Layers, Zap, Check, Ban, Trash2, Pencil, Split, CheckCircle2, Users, RotateCcw, Archive } from 'lucide-react';
import ReportsTable from '../components/admin/ReportsTable';
import LiveMap from '../components/admin/LiveMap';
import { fetchAudit, timeAgo } from '../services/adminService';
import { PLACE_COLOR } from '../lib/icons';

const DAY = 864e5;
const days7 = () => Array.from({ length: 7 }, (_, i) => new Date(new Date().setHours(0, 0, 0, 0) - (6 - i) * DAY).getTime());
const perDay = (dates) => days7().map((d) => dates.filter((x) => x >= d && x < d + DAY).length);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const fmtMin = (ms) => (ms == null ? '—' : ms < 3600e3 ? `${Math.max(1, Math.round(ms / 60e3))} min` : `${(ms / 3600e3).toFixed(1)} h`);

function Spark({ data, color }) {
  const max = Math.max(1, ...data), w = 92, h = 34;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`).join(' ');
  return <svg width={w} height={h} className="absolute bottom-4 right-4" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Kpi({ icon: Icon, tone, label, value, note, noteTone, data, color }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500"><span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}><Icon size={15} /></span>{label}</div>
      <div className="mt-2.5 text-[30px] font-extrabold leading-none tracking-tight">{value}</div>
      <div className={`mt-1.5 text-[11.5px] font-bold ${noteTone}`}>{note}</div>
      <Spark data={data} color={color} />
    </div>
  );
}

const ACT = {
  approved: [Check, 'bg-emerald-50 text-emerald-700', 'published'], rejected: [Ban, 'bg-red-50 text-red-700', 'rejected'],
  pending: [RotateCcw, 'bg-orange-50 text-orange-700', 'moved back to pending'], archived: [Archive, 'bg-slate-100 text-slate-600', 'archived'],
  resolve: [CheckCircle2, 'bg-blue-50 text-blue-700', 'resolved and removed'], delete: [Trash2, 'bg-red-50 text-red-700', 'deleted'],
  edit: [Pencil, 'bg-slate-100 text-slate-600', 'edited'], merge: [Layers, 'bg-violet-50 text-violet-700', 'merged into another incident'],
  unmerge: [Split, 'bg-violet-50 text-violet-700', 'split out as its own incident'], user: [Users, 'bg-slate-100 text-slate-600', 'account updated'],
  admin_add: [Users, 'bg-emerald-50 text-emerald-700', 'given dashboard access'], admin_role: [Users, 'bg-slate-100 text-slate-600', 'administrator role changed'],
  admin_remove: [Users, 'bg-red-50 text-red-700', 'dashboard access removed'],
};
function Activity({ reports }) {
  const [items, setItems] = useState(null);
  const sig = reports.map((r) => r.id + r.status + (r.duplicates?.length || 0)).join();
  useEffect(() => { fetchAudit(8).then(setItems).catch(() => setItems([])); }, [sig]);
  const byId = useMemo(() => {
    const m = {};
    reports.forEach((r) => { m[r.id] = r; (r.duplicates || []).forEach((d) => { m[d.id] = d; }); });
    return m;
  }, [reports]);
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2"><h2 className="text-[15.5px] font-extrabold">Activity</h2><span className="text-xs font-semibold text-slate-500">Latest admin actions</span></div>
      {items === null ? <p className="py-4 text-sm text-slate-400">Loading…</p> : !items.length ? <p className="py-4 text-sm text-slate-400">No actions yet.</p> : (
        <ul>
          {items.map((a) => {
            const key = a.action === 'status' ? a.new_status : a.action;
            const [Icon, tone, verb] = ACT[key] || [Pencil, 'bg-slate-100 text-slate-600', a.action];
            const label = byId[a.report_id]?.label || a.changes?.label || (a.action === 'user' ? 'Citizen account' : a.action.startsWith('admin_') ? a.changes?.email || 'Administrator' : 'Report');
            return (
              <li key={a.id} className="flex gap-3 border-b border-slate-50 py-2.5 text-[12.5px] last:border-0">
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-xl ${tone}`}><Icon size={15} /></span>
                <div><b className="font-bold">{label}</b> {verb}{a.changes?.checklist ? ' after checklist 6/6' : ''}
                  <span className="block text-[11px] text-slate-500">by {a.admin_email || 'unknown'} · {timeAgo(a.created_at)}</span></div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Admin() {
  const { reports, stats, query, view, ask, can } = useOutletContext();
  const k = useMemo(() => {
    const now = Date.now(), all = reports.flatMap((r) => [r, ...(r.duplicates || [])]);
    const live = reports.filter((r) => r.status === 'approved' && r.approved_at && now - new Date(r.approved_at) < 20 * 3600e3);
    const newHour = all.filter((r) => r.status === 'pending' && now - new Date(r.created_at) < 3600e3).length;
    const merged = reports.reduce((n, r) => n + (r.duplicates?.length || 0), 0);
    const reviewed = all.filter((r) => r.reviewed_at && r.status !== 'pending');
    const waits = reviewed.map((r) => new Date(r.reviewed_at) - new Date(r.created_at)).filter((x) => x > 0);
    return {
      newHour, live: live.length, merged, med: median(waits), reviewedN: waits.length,
      sp1: perDay(all.map((r) => +new Date(r.created_at))), sp2: perDay(reports.filter((r) => r.approved_at).map((r) => +new Date(r.approved_at))),
      sp3: perDay(reports.flatMap((r) => (r.duplicates || []).map((d) => +new Date(d.created_at)))),
      sp4: days7().map((d) => median(reviewed.filter((r) => +new Date(r.reviewed_at) >= d && +new Date(r.reviewed_at) < d + DAY).map((r) => new Date(r.reviewed_at) - new Date(r.created_at))) || 0),
    };
  }, [reports]);
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Hourglass} tone="bg-orange-50 text-orange-600" label="Waiting for review" value={stats.pending} note={k.newHour ? `${k.newHour} new in the last hour` : 'No new reports this hour'} noteTone="text-orange-700" data={k.sp1} color="#f97316" />
        <Kpi icon={Radio} tone="bg-emerald-50 text-emerald-600" label="Live on the app" value={k.live} note="Published, under 20 h old" noteTone="text-emerald-700" data={k.sp2} color="#10b981" />
        <Kpi icon={Layers} tone="bg-violet-50 text-violet-600" label="Duplicates merged" value={k.merged} note={`Saved ${k.merged} separate review${k.merged === 1 ? '' : 's'}`} noteTone="text-violet-700" data={k.sp3} color="#8b5cf6" />
        <Kpi icon={Zap} tone="bg-blue-50 text-blue-600" label="Median review time" value={fmtMin(k.med)} note={k.reviewedN ? `Across ${k.reviewedN} reviewed report${k.reviewedN === 1 ? '' : 's'}` : 'No reviews yet'} noteTone="text-blue-700" data={k.sp4} color="#3b82f6" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ReportsTable reports={reports} query={query} view={view} ask={ask} can={can} defaultStatus="pending" title="Review queue" compact />
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><h2 className="text-[15.5px] font-extrabold">Live map</h2><span className="mr-auto text-xs font-semibold text-slate-500">Incidents & emergency services</span><Link to="/admin/map" className="text-xs font-bold text-blue-600">Open</Link></div>
            <LiveMap reports={reports} view={view} />
            <div className="mt-2.5 flex flex-wrap gap-3 text-[11.5px] font-semibold text-slate-500">
              {[['police', 'Police'], ['hospital', 'Hospital'], ['fire', 'Fire station']].map(([t, l]) => <span key={t} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded" style={{ background: PLACE_COLOR[t] }} />{l}</span>)}
              <span>Zoom in to see them · pin colour = incident type</span>
            </div>
          </div>
          <Activity reports={reports} />
        </div>
      </div>
    </>
  );
}
