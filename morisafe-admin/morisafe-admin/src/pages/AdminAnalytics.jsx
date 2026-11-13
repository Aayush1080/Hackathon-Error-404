import { useOutletContext } from 'react-router-dom';
import { countBy } from '../services/adminService';
const Bars = ({ title, data, color = 'bg-blue-600' }) => {
  const rows = Object.entries(data), max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold text-[#14233a]">{title}</h2>
      {rows.length ? rows.map(([k, v]) => (
        <div key={k} className="mb-2 text-sm">
          <div className="flex justify-between"><span>{k}</span><b>{v}</b></div>
          <div className="h-2 rounded bg-slate-100"><div className={`h-2 rounded ${typeof color === 'function' ? color(k) : color}`} style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      )) : <p className="text-sm text-slate-400">No data.</p>}
    </div>
  );
};
const dkey = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export default function AdminAnalytics() {
  const { reports } = useOutletContext();
  const days = {};
  for (let i = 13; i >= 0; i--) days[dkey(Date.now() - i * 864e5)] = 0;
  reports.forEach((r) => { const k = dkey(r.created_at); if (k in days) days[k]++; });
  const top = Object.fromEntries(Object.entries(countBy(reports, (r) => r.location_name)).sort((a, b) => b[1] - a[1]).slice(0, 6));
  const sc = (k) => ({ pending: 'bg-orange-500', approved: 'bg-green-600', rejected: 'bg-red-600' })[k];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bars title="Reports by category" data={countBy(reports, (r) => r.category)} />
      <Bars title="Reports by status" data={countBy(reports, (r) => r.status)} color={sc} />
      <Bars title="Submitted, last 14 days" data={days} color="bg-[#14233a]" />
      <Bars title="Most affected locations" data={top} color="bg-red-600" />
    </div>
  );
}
