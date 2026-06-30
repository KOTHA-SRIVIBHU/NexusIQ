import { useAuth } from '../context/AuthContext';
import { LogOut, Brain, Upload, Search, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { user, organization, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">NexusIQ</span>
              <span className="text-sm text-gray-400 ml-1">/ {organization?.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to NexusIQ</h1>
          <p className="text-gray-500 mt-1">Upload documents. Know everything.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Upload className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Upload</h3>
            </div>
            <p className="text-sm text-gray-500">Drag and drop PDFs, DOCX, PPTX, or Markdown files</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Search className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Search</h3>
            </div>
            <p className="text-sm text-gray-500">Find documents across your entire knowledge base</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Analytics</h3>
            </div>
            <p className="text-sm text-gray-500">Track uploads, tags, and document usage</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your knowledge base is empty</h2>
          <p className="text-gray-500 text-sm mb-4">Upload your first document to get started with AI-powered insights</p>
          <button className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </main>
    </div>
  );
}
