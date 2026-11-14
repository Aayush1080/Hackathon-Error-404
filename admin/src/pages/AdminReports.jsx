import { useOutletContext } from 'react-router-dom';
import ReportsTable from '../components/admin/ReportsTable';
export default function AdminReports() {
  const { reports, query, view, ask, can } = useOutletContext();
  return <ReportsTable reports={reports} query={query} view={view} ask={ask} can={can} defaultStatus="pending" title="Review queue" />;
}
