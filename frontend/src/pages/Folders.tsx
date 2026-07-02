import { useState, useEffect, FormEvent } from 'react';
import { FolderOpen, Plus, X, Pencil, Trash2, FileText, ChevronRight, ChevronDown, Loader2, AlertCircle, Building2, Globe } from 'lucide-react';

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  _count: { documents: number };
  team?: { id: string; name: string } | null;
}

interface DocInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt: string;
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

export default function Folders() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folderDocs, setFolderDocs] = useState<Record<string, DocInfo[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());

  const fetchFolders = async () => {
    try {
      const [d, t] = await Promise.all([
        api('/api/folders'),
        api('/api/teams'),
      ]);
      setFolders(d.folders);
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), teamId: newTeamId || undefined }),
      });
      setNewName('');
      setNewTeamId('');
      setShowCreate(false);
      await fetchFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await api(`/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditing(null);
      await fetchFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this folder? Documents will not be deleted.')) return;
    try {
      await api(`/api/folders/${id}`, { method: 'DELETE' });
      setExpanded((prev) => { const next = new Set(prev); next.delete(id); return next; });
      await fetchFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const toggleExpand = async (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!folderDocs[id]) {
        setLoadingDocs((prev) => new Set(prev).add(id));
        try {
          const d = await api(`/api/folders/${id}/documents`);
          setFolderDocs((prev) => ({ ...prev, [id]: d.documents }));
        } catch { /* ignore */ }
        setLoadingDocs((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }
    setExpanded(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
          <p className="text-gray-500 mt-1 text-sm">Organize your documents into folders</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm">
          <Plus className="w-4 h-4" /> New Folder
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name" autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
            >
              <option value="">Organization folder (everyone can view)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>Team folder — {t.name} (team only)</option>
              ))}
            </select>
            <button type="submit" disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {folders.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No folders yet</h2>
          <p className="text-gray-500 text-sm">Create your first folder to organize documents</p>
        </div>
      )}

      <div className="space-y-2">
        {folders.map((folder) => (
          <div key={folder.id} className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleExpand(folder.id)} className="text-gray-400 hover:text-gray-600">
                {expanded.has(folder.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <FolderOpen className="w-5 h-5 text-indigo-500 shrink-0" />
              {editing === folder.id ? (
                <form onSubmit={(e) => { e.preventDefault(); handleRename(folder.id); }}
                  className="flex-1 flex gap-2">
                  <input
                    type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus onBlur={() => setEditing(null)}
                  />
                  <button type="submit" className="text-xs text-indigo-600 font-medium">Save</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">{folder.name}</span>
                  {folder.team ? (
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5" /> {folder.team.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" /> Org
                    </span>
                  )}
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {folder._count.documents} doc{folder._count.documents !== 1 && 's'}
                  </span>
                  <button onClick={() => { setEditing(folder.id); setEditName(folder.name); }}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(folder.id)}
                    className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {expanded.has(folder.id) && (
              <div className="border-t border-gray-100 px-4 py-3 pl-12 space-y-2">
                {loadingDocs.has(folder.id) ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : (folderDocs[folder.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No documents in this folder</p>
                ) : (
                  folderDocs[folder.id].map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700 truncate">{doc.originalName}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {doc.status === 'READY' ? 'Ready' : doc.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
