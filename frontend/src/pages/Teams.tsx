import { useState, useEffect, FormEvent } from 'react';
import { useAuth, type UserWithRole } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, X, Building2, Users, Pencil, Trash2, UserPlus, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Select from '../components/Select';

interface TeamMember { user: { id: string; name: string; email: string }; role: string; }
interface Team { id: string; name: string; description: string; members: TeamMember[]; }

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

export default function Teams() {
  const { user, organization } = useAuth();
  const currentUser = user as UserWithRole | null;
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const fetchTeams = async () => {
    try { const d = await api('/api/teams'); setTeams(d.teams); } catch { /* ignore */ }
    try { const d = await api('/api/auth/members'); setMembers(d.members); } catch { /* ignore */ }
  };

  useEffect(() => { fetchTeams(); }, [organization?.id]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/teams', { method: 'POST', body: JSON.stringify({ name: teamName, description: teamDesc }) });
      setTeamName(''); setTeamDesc(''); setShowCreate(false); fetchTeams();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to create team'); }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api(`/api/teams/${editing}`, { method: 'PUT', body: JSON.stringify({ name: teamName, description: teamDesc }) });
      setEditing(null); setTeamName(''); setTeamDesc(''); fetchTeams();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to update team'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete team "${name}"? Members will become unassigned.`)) return;
    try { await api(`/api/teams/${id}`, { method: 'DELETE' }); fetchTeams(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete team'); }
  };

  const handleAddMember = async (teamId: string) => {
    if (!selectedUserId) return;
    try {
      await api(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId: selectedUserId, role: 'MEMBER' }) });
      setAddingMember(null); setSelectedUserId(''); fetchTeams();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to add member'); }
  };

  const handleRemoveMember = async (teamId: string, userId: string, name: string) => {
    if (!confirm(`Remove ${name} from team?`)) return;
    try { await api(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' }); fetchTeams(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to remove member'); }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const availableMembers = (teamId: string) => members.filter((m) => !teams.find((t) => t.id === teamId)?.members.find((tm) => tm.user.id === m.id));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-500 mt-1">{organization?.name}</p>
        </div>
        {canManage && (
          <button onClick={() => { setShowCreate(true); setTeamName(''); setTeamDesc(''); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Create Team
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Team</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
            <input type="text" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {teams.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No teams yet. Create one to organize your members.</p>
          </div>
        )}
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between">
              <button onClick={() => toggleExpand(team.id)} className="flex items-center gap-3 text-left flex-1">
                <Building2 className="w-5 h-5 text-indigo-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">{team.name}</p>
                  <p className="text-xs text-gray-500">{team.members.length} members{team.description ? ` — ${team.description}` : ''}</p>
                </div>
                {expanded.has(team.id) ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>
              <Link to={`/teams/${team.id}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 shrink-0 ml-1" title="Team details">
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button onClick={() => { setEditing(team.id); setTeamName(team.name); setTeamDesc(team.description); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(team.id, team.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {editing === team.id && (
              <div className="px-6 pb-4 border-b border-gray-100">
                <form onSubmit={handleUpdate} className="space-y-3">
                  <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
                  <input type="text" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Description" />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-700 px-3 py-1.5 text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {expanded.has(team.id) && (
              <div className="divide-y divide-gray-50">
                {team.members.map((tm) => (
                  <div key={tm.user.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 shrink-0">{tm.user.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tm.user.name}{tm.role === 'LEAD' && <span className="text-xs text-amber-600 ml-1">(Lead)</span>}</p>
                        <p className="text-xs text-gray-500">{tm.user.email}</p>
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={() => handleRemoveMember(team.id, tm.user.id, tm.user.name)} className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                    )}
                  </div>
                ))}
                {canManage && (
                  <div className="px-6 py-3">
                    {addingMember === team.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleAddMember(team.id); }} className="flex items-center gap-2">
                        <Select
                          value={selectedUserId}
                          onChange={setSelectedUserId}
                          options={[
                            { value: '', label: 'Select member...', disabled: true },
                            ...availableMembers(team.id).map((m) => ({ value: m.id, label: m.name })),
                          ]}
                          className="flex-1"
                        />
                        <button type="submit" disabled={!selectedUserId} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"><Check className="w-3 h-3" /></button>
                        <button type="button" onClick={() => setAddingMember(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"><X className="w-3 h-3" /></button>
                      </form>
                    ) : (
                      <button onClick={() => { setAddingMember(team.id); setSelectedUserId(''); }} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                        <UserPlus className="w-3 h-3" /> Add member
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
