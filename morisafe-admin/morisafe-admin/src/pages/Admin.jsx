import { useOutletContext } from 'react-router-dom';
import { FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';
import StatCard from '../components/admin/StatCard';
import ReportsTable from '../components/admin/ReportsTable';
export default function Admin() {
  const { reports, stats, query, view, ask } = useOutletContext();
  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) + '% of all reports' : '—');
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} tone="blue" label="Total Reports" value={stats.total} note="All submissions" />
        <StatCard icon={Clock} tone="orange" label="Pending Reports" value={stats.pending} note={pct(stats.pending)} />
        <StatCard icon={CheckCircle2} tone="green" label="Approved Reports" value={stats.approved} note={pct(stats.approved)} />
        <StatCard icon={XCircle} tone="red" label="Rejected Reports" value={stats.rejected} note={pct(stats.rejected)} />
      </div>
      <ReportsTable reports={reports} query={query} view={view} ask={ask} />
    </>
  );
}
