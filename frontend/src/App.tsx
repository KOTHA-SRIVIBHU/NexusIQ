import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Requests from './pages/Requests';
import UploadPage from './pages/Upload';
import SearchPage from './pages/Search';
import AskPage from './pages/Ask';
import OrgFolders from './pages/OrgFolders';
import FolderDetail from './pages/FolderDetail';
import FolderLogs from './pages/FolderLogs';
import FolderFiles from './pages/FolderFiles';
import AnalyticsPage from './pages/Analytics';
import AcceptInvite from './pages/AcceptInvite';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route path="members" element={<Members />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="requests" element={<Requests />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="ask" element={<AskPage />} />
          <Route path="folders" element={<OrgFolders />} />
          <Route path="folders/:id/files" element={<FolderFiles />} />
          <Route path="folders/:id/logs" element={<FolderLogs />} />
          <Route path="folders/:id" element={<FolderDetail />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
