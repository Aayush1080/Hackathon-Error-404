import { useOutletContext } from 'react-router-dom';
import ReportsTable from '../components/admin/ReportsTable';
export default function AdminReports() {
  const { reports, query, view, ask } = useOutletContext();
  return <ReportsTable reports={reports} query={query} view={view} ask={ask} defaultStatus="pending" />;
}
