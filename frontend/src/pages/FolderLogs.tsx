import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { History, Loader2, AlertCircle, ChevronLeft, ChevronRight, Filter, ArrowLeft } from 'lucide-react';

interface LogEntry {
  id: string; action: string; documentName: string | null;
  userName: string; folderId: string; folderName: string; createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[]; total: number; page: number; limit: number; pages: number;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

function formatDate(d: string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export default function FolderLogs() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50', folderId: id });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/logs?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Failed to fetch logs');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, actionFilter, id]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to={`/folders/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to folder
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg"><History className="w-6 h-6 text-indigo-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-500 mt-1 text-sm">Complete history of uploads and deletions</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="outline-none bg-transparent text-sm text-gray-600">
            <option value="">All actions</option>
            <option value="UPLOAD">Uploads</option>
            <option value="DELETE">Deletes</option>
          </select>
        </div>
        {data && (
          <span className="text-xs text-gray-400 ml-auto">{data.total} total logs</span>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : data && data.logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No logs found for this folder</p>
        </div>
      ) : data ? (
        <>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {data.logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full shrink-0 ${log.action === 'UPLOAD' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate">
                    <span className="font-medium">{log.userName}</span>
                    {' '}{log.action === 'UPLOAD' ? 'uploaded' : 'deleted'}{' '}
                    <span className="font-medium">{log.documentName || 'a file'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">in {log.folderName}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-sm text-gray-500">Page {data.page} of {data.pages}</span>
              <button onClick={() => setPage(Math.min(data.pages, page + 1))} disabled={page >= data.pages}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}