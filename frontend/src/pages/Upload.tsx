import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload as UploadIcon, File, FileText, FileSpreadsheet, FileImage, X, CheckCircle, AlertCircle, Loader2, FolderOpen } from 'lucide-react';

interface DocItem {
  id: string; originalName: string; mimeType: string; size: number; status: string; errorMessage?: string;
  uploadedBy?: { id: string; name: string };
  createdAt?: string;
  folder?: { id: string; name: string } | null;
}

interface FolderOption {
  id: string; name: string; _count: { documents: number }; team?: { id: string; name: string } | null;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: typeof Loader2 }> = {
  UPLOADING: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Uploading...', icon: Loader2 },
  PROCESSING: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Processing...', icon: Loader2 },
  READY: { color: 'text-green-600', bg: 'bg-green-100', label: 'Ready', icon: CheckCircle },
  FAILED: { color: 'text-red-600', bg: 'bg-red-100', label: 'Failed', icon: AlertCircle },
};

const fileIcon = (mime: string) => {
  if (mime.includes('pdf')) return FileText;
  if (mime.includes('docx')) return FileText;
  if (mime.includes('presentation')) return FileSpreadsheet;
  return File;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [folderOpen, setFolderOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try { const d = await api('/api/documents'); setDocuments(d.documents); } catch { /* ignore */ }
    try { const f = await api('/api/folders'); setFolders(f.folders); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDocs(); }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) setFolderOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'UPLOADING' || d.status === 'PROCESSING');
    if (!hasProcessing) return;
    const interval = setInterval(fetchDocs, 2000);
    return () => clearInterval(interval);
  }, [documents, fetchDocs]);

  const handleUpload = async (files: FileList) => {
    setError('');
    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }
    if (selectedFolder) {
      formData.append('folderId', selectedFolder);
    }
    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error); }
      await fetchDocs();
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleUpload(e.target.files);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Documents</h1>
        <p className="text-gray-500 mt-1">PDF, DOCX, PPTX, Markdown — max 50MB each</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.pptx,.md,.txt" onChange={handleFileSelect} className="hidden" />
        <UploadIcon className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-indigo-500' : 'text-gray-300'}`} />
        <p className="text-gray-600 font-medium">
          {uploading ? 'Uploading...' : dragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Supports PDF, DOCX, PPTX, Markdown, and plain text</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative" ref={folderRef}>
          <button
            type="button"
            onClick={() => setFolderOpen(!folderOpen)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 bg-white"
          >
            <FolderOpen className="w-4 h-4" />
            {selectedFolder
              ? folders.find((f) => f.id === selectedFolder)?.name || 'Select folder'
              : 'No folder'}
          </button>
          {folderOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 max-h-48 overflow-y-auto">
              <button
                onClick={() => { setSelectedFolder(''); setFolderOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm ${!selectedFolder ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                No folder
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFolder(f.id); setFolderOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                    selectedFolder === f.id ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {f.team && <span className="text-[10px] text-gray-400">{f.team.name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedFolder && (
          <button
            onClick={() => setSelectedFolder('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {documents.length === 0 && !uploading && (
          <p className="text-center text-gray-400 py-8 text-sm">No documents yet. Upload one above.</p>
        )}
        {documents.map((doc) => {
          const cfg = statusConfig[doc.status] || statusConfig.FAILED;
          const Icon = cfg.icon;
          const FileIcon = fileIcon(doc.mimeType);
          const spinning = doc.status === 'UPLOADING' || doc.status === 'PROCESSING';
          return (
            <div key={doc.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3 hover:border-gray-300 transition-colors">
              <div className="p-1.5 bg-gray-50 rounded-lg shrink-0">
                <FileIcon className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{formatSize(doc.size)}</span>
                  {doc.uploadedBy?.name && <span>by {doc.uploadedBy.name}</span>}
                  {doc.createdAt && <span>{new Date(doc.createdAt).toLocaleDateString()}</span>}
                  {doc.folder && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <FolderOpen className="w-3 h-3" />{doc.folder.name}
                    </span>
                  )}
                </div>
                {doc.status === 'FAILED' && doc.errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{doc.errorMessage}</p>
                )}
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                <Icon className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
                {cfg.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
