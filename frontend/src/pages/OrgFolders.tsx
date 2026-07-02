import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, X, Trash2, Loader2, AlertCircle, Globe, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FolderItem {
  id: string; name: string; _count: { documents: number };
  minViewRole: string; minEditRole: string;
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

const roleOptions = [
  { value: 'VIEWER', label: 'Everyone (VIEWER+)' },
  { value: 'EDITOR', label: 'Editors & above (EDITOR+)' },
  { value: 'ADMIN', label: 'Admins only (ADMIN+)' },
];

export default function OrgFolders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newViewRole, setNewViewRole] = useState('VIEWER');
  const [newEditRole, setNewEditRole] = useState('EDITOR');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const orgFolders = folders.filter((f) => !f.team);

  const fetchFolders = async () => {
    try { const d = await api('/api/folders'); setFolders(d.folders); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load folders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFolders(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), minViewRole: newViewRole, minEditRole: newEditRole }),
      });
      setNewName(''); setShowCreate(false);
      await fetchFolders();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create folder'); }
    finally { setCreating(false); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const confirmDelete = async () => {
    if (deleteConfirm !== 'DELETE' || !deleteModal) return;
    setBatchDeleting(true);
    try {
      if (deleteModal.ids.length === 1) {
        await api(`/api/folders/${deleteModal.ids[0]}`, { method: 'DELETE' });
      } else {
        await api('/api/folders/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ folderIds: deleteModal.ids }),
        });
      }
      setDeleteModal(null); setDeleteConfirm(''); setSelected(new Set());
      await fetchFolders();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setBatchDeleting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Folders</h1>
          <p className="text-gray-500 mt-1 text-sm">Browse and manage organizational documents</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${selectMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {selectMode ? <ChevronDown className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {selectMode ? 'Done' : 'Select'}
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm">
                <Plus className="w-4 h-4" /> New Folder
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Create Organizational Folder</h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Folder name" autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum view role</label>
              <select value={newViewRole} onChange={(e) => setNewViewRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum edit role</label>
              <select value={newEditRole} onChange={(e) => setNewEditRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !newName.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm">{creating ? 'Creating...' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {orgFolders.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No organizational folders</h2>
          <p className="text-gray-500 text-sm">Create your first folder to organize documents</p>
        </div>
      ) : (
        <>
          {selectMode && selected.size > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="text-gray-600">{selected.size} selected</span>
              <button onClick={() => {
                const names = orgFolders.filter(f => selected.has(f.id)).map(f => f.name);
                setDeleteModal({ ids: Array.from(selected), name: names.join(', ') });
                setDeleteConfirm('');
              }} className="text-red-600 hover:text-red-700 font-medium ml-auto">Delete Selected</button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {orgFolders.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors relative group">
                {selectMode && isAdmin ? (
                  <button onClick={() => toggleSelect(f.id)} className="absolute top-3 right-3 text-gray-400 hover:text-indigo-600">
                    {selected.has(f.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                  </button>
                ) : isAdmin && f._count.documents === 0 && (
                  <button onClick={() => { setDeleteModal({ ids: [f.id], name: f.name }); setDeleteConfirm(''); }}
                    className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete folder">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <Link to={`/folders/${f.id}`} className="block">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                      <Globe className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{f.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{f._count.documents} documents</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">View: {f.minViewRole}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Edit: {f.minEditRole}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Delete folder{deleteModal.ids.length > 1 ? 's' : ''}</h2>
              <button onClick={() => setDeleteModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Permanently delete <span className="font-medium text-gray-900">{deleteModal.ids.length > 1 ? `${deleteModal.ids.length} folders` : deleteModal.name}</span>?
            </p>
            <p className="text-xs text-gray-500 mb-4">Only empty folders can be deleted. Files inside will block deletion.</p>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-700">Type <span className="font-bold">DELETE</span> to confirm</p>
            </div>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE" autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm mb-4"
              onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirm === 'DELETE') confirmDelete(); }}
            />
            <div className="flex gap-2">
              <button onClick={confirmDelete} disabled={deleteConfirm !== 'DELETE' || batchDeleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 text-sm">
                {batchDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteModal(null)} className="flex-1 text-gray-500 hover:text-gray-700 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
