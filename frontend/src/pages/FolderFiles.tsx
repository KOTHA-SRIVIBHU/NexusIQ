import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, Loader2, AlertCircle, CheckSquare, Square, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DocItem {
  id: string; originalName: string; mimeType: string; size: number; status: string; errorMessage?: string;
  createdAt: string; uploadedById: string;
  uploadedBy: { id: string; name: string; email: string };
}

interface FolderData {
  id: string; name: string; minViewRole: string; minEditRole: string;
  teamId: string | null; documents: DocItem[];
  team?: { id: string; name: string } | null;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  UPLOADING: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Uploading...' },
  PROCESSING: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing...' },
  READY: { color: 'text-green-600', bg: 'bg-green-100', label: 'Ready' },
  FAILED: { color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
};

export default function FolderFiles() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectDocMode, setSelectDocMode] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isEditor = user?.role === 'EDITOR' || isAdmin;

  const fetchFolder = useCallback(async () => {
    if (!id) return;
    try { const d = await api(`/api/folders/${id}`); setFolder(d.folder); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load folder'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchFolder(); }, [fetchFolder]);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError('');
    const formData = new FormData();
    for (const file of files) formData.append('file', file);
    if (id) formData.append('folderId', id);
    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error); }
      await fetchFolder();
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null); setDeleteConfirm('');
      await fetchFolder();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete document'); }
    finally { setDeleting(false); }
  };

  const handleBatchDelete = async () => {
    if (selectedDocs.size === 0) return;
    setBatchDeleting(true);
    try {
      const res = await fetch('/api/documents/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ documentIds: Array.from(selectedDocs) }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Failed' })); throw new Error(err.error); }
      setSelectedDocs(new Set()); setBatchDeleteModal(false);
      await fetchFolder();
    } catch (err) { setError(err instanceof Error ? err.message : 'Batch delete failed'); }
    finally { setBatchDeleting(false); }
  };

  const canDelete = (doc: DocItem) => {
    if (isAdmin) return true;
    if (user?.role === 'EDITOR' && doc.uploadedById === user?.id) {
      return Date.now() - new Date(doc.createdAt).getTime() < 3600000;
    }
    return false;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>;

  if (error && !folder) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
        <Link to="/folders" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to folders
        </Link>
      </div>
    );
  }

  if (!folder) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to={`/folders/${folder.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to folder
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg"><FileText className="w-6 h-6 text-indigo-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Files in {folder.name}</h1>
            <p className="text-gray-500 mt-1 text-sm">{folder.documents.length} file{folder.documents.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isEditor && (
        <div className="mb-6">
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
            <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.pptx,.md,.txt" onChange={(e) => e.target.files && handleUpload(e.target.files)} className="hidden" />
            {uploading ? <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" /> : <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />}
            <p className="text-sm text-gray-600 font-medium">{uploading ? 'Uploading...' : 'Click to upload files to this folder'}</p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, Markdown, TXT</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Files</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{folder.documents.length}</span>
          {isEditor && folder.documents.length > 0 && (
            <button onClick={() => { setSelectDocMode(!selectDocMode); setSelectedDocs(new Set()); }}
              className={`text-xs px-2 py-1 rounded-lg border ${selectDocMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {selectDocMode ? 'Done' : 'Select'}
            </button>
          )}
        </div>

        {selectDocMode && selectedDocs.size > 0 && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-sm">
            <span className="text-amber-800 font-medium">{selectedDocs.size} selected</span>
            <button onClick={() => setBatchDeleteModal(true)} className="text-red-600 hover:text-red-700 font-medium ml-auto">Delete Selected</button>
          </div>
        )}

        {folder.documents.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No files in this folder</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {folder.documents.map((doc) => {
              const cfg = statusConfig[doc.status] || statusConfig.FAILED;
              const canDel = canDelete(doc);
              return (
                <div key={doc.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 group ${selectedDocs.has(doc.id) ? 'bg-indigo-50/50' : ''}`}>
                  {selectDocMode && canDel && (
                    <button onClick={() => {
                      const next = new Set(selectedDocs);
                      next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                      setSelectedDocs(next);
                    }}>
                      {selectedDocs.has(doc.id)
                        ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                        : <Square className="w-5 h-5 text-gray-400" />}
                    </button>
                  )}
                  <div className="p-1.5 bg-gray-50 rounded-lg shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{formatSize(doc.size)}</span>
                      <span>by {doc.uploadedBy.name}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                    {doc.status === 'FAILED' && doc.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5">{doc.errorMessage}</p>
                    )}
                  </div>
                  <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</div>
                  {!selectDocMode && canDel && (
                    <button onClick={() => { setDeleteTarget(doc); setDeleteConfirm(''); }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete document">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Delete Confirmation Modal */}
      {batchDeleteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setBatchDeleteModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Delete {selectedDocs.size} file{selectedDocs.size !== 1 ? 's' : ''}</h2>
              <button onClick={() => setBatchDeleteModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Type <span className="font-bold">DELETE</span> to confirm.</p>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-700">Type <span className="font-bold">DELETE</span> to confirm</p>
            </div>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE" autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm mb-4"
              onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirm === 'DELETE') { handleBatchDelete(); setDeleteConfirm(''); } }}
            />
            <div className="flex gap-2">
              <button onClick={() => { handleBatchDelete(); setDeleteConfirm(''); }} disabled={deleteConfirm !== 'DELETE' || batchDeleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 text-sm">
                {batchDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setBatchDeleteModal(false)} className="flex-1 text-gray-500 hover:text-gray-700 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Delete document</h2>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              This will permanently delete <span className="font-medium text-gray-900">{deleteTarget.originalName}</span>.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-700">Type <span className="font-bold">DELETE</span> to confirm</p>
            </div>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE" autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm mb-4"
              onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirm === 'DELETE') handleDeleteConfirm(); }}
            />
            <div className="flex gap-2">
              <button onClick={handleDeleteConfirm} disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 text-sm">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 text-gray-500 hover:text-gray-700 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}