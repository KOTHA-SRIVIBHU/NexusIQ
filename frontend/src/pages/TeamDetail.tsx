import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, Users, FolderOpen, FileText, ArrowLeft, Loader2, AlertCircle, HardDrive, CheckCircle, Plus, X, Globe, Trash2, CheckSquare, Square, ChevronDown, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TeamData {
  id: string; name: string; description: string;
  members: { user: { id: string; name: string; email: string }; role: string }[];
  folders: {
    id: string; name: string; _count: { documents: number };
    minViewRole: string; minEditRole: string;
    documents: { id: string; originalName: string }[];
  }[];
}

interface TeamAnalytics {
  teamName: string; totalDocs: number; readyDocs: number; failedDocs: number;
  totalTokens: number; folders: number; members: number; docsThisWeek: number;
  docsByType: { mimeType: string; _count: number }[];
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

function formatTokens(n: number) {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}K`;
}

const roleOptions = [
  { value: 'VIEWER', label: 'Everyone (VIEWER+)' },
  { value: 'EDITOR', label: 'Editors & above (EDITOR+)' },
  { value: 'ADMIN', label: 'Admins only (ADMIN+)' },
];

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newViewRole, setNewViewRole] = useState('VIEWER');
  const [newEditRole, setNewEditRole] = useState('EDITOR');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [batchDeleting, setBatchDeleting] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [teamData, analyticsData] = await Promise.all([
          api(`/api/teams/${id}`),
          api(`/api/analytics/team/${id}`),
        ]);
        setTeam(teamData.team);
        setAnalytics(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
      if (id) { const d = await api(`/api/teams/${id}`); setTeam(d.team); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setBatchDeleting(false); }
  };

  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !id) return;
    setCreating(true);
    try {
      await api('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), teamId: id, minViewRole: newViewRole, minEditRole: newEditRole, isPrivate: newIsPrivate }),
      });
      setNewName(''); setShowCreate(false);
      const d = await api(`/api/teams/${id}`);
      setTeam(d.team);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create folder'); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>;

  if (error && !team) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/teams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><Building2 className="w-6 h-6 text-indigo-600" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              {team.description && <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${selectMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {selectMode ? <ChevronDown className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {selectMode ? 'Done' : 'Select'}
              </button>
              <button onClick={() => { setShowCreate(true); setSelectMode(false); }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm">
                <Plus className="w-4 h-4" /> New Folder
              </button>
            </div>
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
        <form onSubmit={handleCreateFolder} className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Create Team Folder</h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name" autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Who can view</label>
              <select value={newViewRole} onChange={(e) => setNewViewRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Who can edit</label>
              <select value={newEditRole} onChange={(e) => setNewEditRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <button type="button" onClick={() => setNewIsPrivate(!newIsPrivate)}
              className={`relative w-10 h-5 rounded-full transition-colors ${newIsPrivate ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${newIsPrivate ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-gray-600">{newIsPrivate ? 'Private (team members only)' : 'Public (visible per role)'}</span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !newName.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setNewName(''); }}
              className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Analytics cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-gray-500 font-medium">Docs</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{analytics.totalDocs}</p>
            <p className="text-xs text-gray-400">{analytics.docsThisWeek} this week</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 font-medium">Ready</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{analytics.readyDocs}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500 font-medium">Tokens</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatTokens(analytics.totalTokens)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-gray-500 font-medium">Members</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{analytics.members}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Members column */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Members</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{team.members.length}</span>
            </div>
            <div className="space-y-3">
              {team.members.map((tm) => (
                <div key={tm.user.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 shrink-0">
                    {tm.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tm.user.name}
                      {tm.role === 'LEAD' && <span className="text-xs text-amber-600 ml-1">(Lead)</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{tm.user.email}</p>
                  </div>
                </div>
              ))}
              {team.members.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No members yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Folders column */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Folders</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{team.folders.length}</span>
            </div>

            {selectMode && selected.size > 0 && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <span className="text-gray-600">{selected.size} selected</span>
                <button onClick={() => {
                  const names = team.folders.filter(f => selected.has(f.id)).map(f => f.name);
                  setDeleteModal({ ids: Array.from(selected), name: names.join(', ') });
                  setDeleteConfirm('');
                }} className="text-red-600 hover:text-red-700 font-medium ml-auto">Delete Selected</button>
              </div>
            )}

            {team.folders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No folders yet</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {team.folders.map((folder) => (
                  <div key={folder.id} className="relative group">
                    {selectMode && isAdmin ? (
                      <button onClick={() => toggleSelect(folder.id)}
                        className="absolute top-2 right-2 z-10 text-gray-400 hover:text-indigo-600">
                        {selected.has(folder.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                      </button>
                    ) : isAdmin && folder._count.documents === 0 && (
                      <button onClick={() => { setDeleteModal({ ids: [folder.id], name: folder.name }); setDeleteConfirm(''); }}
                        className="absolute top-2 right-2 z-10 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete folder">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <Link to={`/folders/${folder.id}`}
                      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0">
                          <FolderOpen className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                            {folder.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{folder._count.documents} docs</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${folder.isPrivate ? 'text-amber-600 bg-amber-50' : 'text-gray-400 bg-gray-100'}`}>
                              {folder.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                              {folder.isPrivate ? 'Private' : 'Public'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
            <p className="text-xs text-gray-500 mb-4">Only empty folders can be deleted.</p>
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
