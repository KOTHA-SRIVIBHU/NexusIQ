import { useState, useEffect } from 'react';
import { BarChart3, FileText, FolderOpen, Users, Loader2, AlertCircle, HardDrive, CheckCircle, XCircle } from 'lucide-react';

interface Overview {
  totalDocs: number;
  readyDocs: number;
  failedDocs: number;
  totalTokens: number;
  folders: number;
  members: number;
  docsThisWeek: number;
  docsByType: { mimeType: string; _count: number }[];
  recentUploads: {
    id: string; originalName: string; mimeType: string; size: number; status: string; createdAt: string;
  }[];
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

const mimeLabels: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/markdown': 'Markdown',
  'text/plain': 'Text',
};

const mimeColors: Record<string, string> = {
  'application/pdf': 'bg-red-100 text-red-700',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'bg-blue-100 text-blue-700',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'bg-orange-100 text-orange-700',
  'text/markdown': 'bg-purple-100 text-purple-700',
  'text/plain': 'bg-gray-100 text-gray-700',
};

export default function Analytics() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await api('/api/analytics/overview');
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalSize = data.docsByType.reduce((acc, t) => acc + t._count, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1 text-sm">Usage statistics for your organization</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg"><FileText className="w-4 h-4 text-indigo-600" /></div>
            <span className="text-xs text-gray-500 font-medium">Total Docs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.totalDocs}</p>
          <p className="text-xs text-gray-400 mt-1">{data.docsThisWeek} this week</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded-lg"><CheckCircle className="w-4 h-4 text-green-600" /></div>
            <span className="text-xs text-gray-500 font-medium">Ready</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.readyDocs}</p>
          {data.failedDocs > 0 && <p className="text-xs text-red-400 mt-1">{data.failedDocs} failed</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-lg"><HardDrive className="w-4 h-4 text-purple-600" /></div>
            <span className="text-xs text-gray-500 font-medium">Total Tokens</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatTokens(data.totalTokens)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-lg"><FolderOpen className="w-4 h-4 text-amber-600" /></div>
            <span className="text-xs text-gray-500 font-medium">Folders</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.folders}</p>
          <p className="text-xs text-gray-400 mt-1">{data.members} org members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Documents by Type</h3>
          {data.docsByType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No documents yet</p>
          ) : (
            <div className="space-y-3">
              {data.docsByType.map((t) => {
                const label = mimeLabels[t.mimeType] || t.mimeType.split('/').pop() || 'Unknown';
                const color = mimeColors[t.mimeType] || 'bg-gray-100 text-gray-700';
                const pct = totalSize > 0 ? ((t._count / totalSize) * 100).toFixed(0) : '0';
                return (
                  <div key={t.mimeType}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                      <span className="text-xs text-gray-500">{t._count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Recent Uploads</h3>
          {data.recentUploads.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No uploads yet</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recentUploads.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate flex-1">{doc.originalName}</span>
                  <span className="text-xs text-gray-400">{formatSize(doc.size)}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    doc.status === 'READY' ? 'bg-green-100 text-green-700' :
                    doc.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{doc.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
