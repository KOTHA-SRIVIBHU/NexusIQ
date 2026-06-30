import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
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
          <Route path="upload" element={<div className="p-8 text-center text-gray-400">Upload page coming in M2</div>} />
          <Route path="search" element={<div className="p-8 text-center text-gray-400">Search page coming in M6</div>} />
          <Route path="analytics" element={<div className="p-8 text-center text-gray-400">Analytics page coming in M7</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
