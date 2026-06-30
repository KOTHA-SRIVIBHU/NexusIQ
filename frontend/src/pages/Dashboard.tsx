import { useAuth } from '../context/AuthContext';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Brain, Upload, Search, BarChart3, Users, LayoutDashboard } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/members', label: 'Members', icon: Users },
];

export default function Dashboard() {
  const { user, organization, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-gray-900">NexusIQ</span>
              <p className="text-xs text-gray-400">{organization?.name}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{user?.name}</p>
              <p className="text-gray-500 text-xs capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-600"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {location.pathname === '/' ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to NexusIQ</h1>
              <p className="text-gray-500 mt-1">Upload documents. Know everything.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Link to="/upload" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Upload className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Upload</h3>
                </div>
                <p className="text-sm text-gray-500">Drag and drop PDFs, DOCX, PPTX, or Markdown files</p>
              </Link>

              <Link to="/search" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Search className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Search</h3>
                </div>
                <p className="text-sm text-gray-500">Find documents across your entire knowledge base</p>
              </Link>

              <Link to="/analytics" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Analytics</h3>
                </div>
                <p className="text-sm text-gray-500">Track uploads, tags, and document usage</p>
              </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Your knowledge base is empty</h2>
              <p className="text-gray-500 text-sm mb-4">Upload your first document to get started with AI-powered insights</p>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
