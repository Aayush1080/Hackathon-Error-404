import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import Admin from './pages/Admin';
import AdminReports from './pages/AdminReports';
import AdminMap from './pages/AdminMap';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminPlaceholder from './pages/AdminPlaceholder';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Admin />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="map" element={<AdminMap />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
