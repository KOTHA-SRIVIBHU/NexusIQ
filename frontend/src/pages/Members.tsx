import { useState, useEffect, FormEvent } from 'react';
import { useAuth, type UserWithRole } from '../context/AuthContext';
import { Copy, Check, X, UserPlus, Users, Shield, Building2 } from 'lucide-react';
import Select from '../components/Select';

interface Member { id: string; name: string; email: string; role: string; }
interface Invitation { id: string; email: string; role: string; inviteLink: string; acceptedAt: string | null; }
interface Team { id: string; name: string; description: string; members: { user: { id: string; name: string; email: string }; role: string }[]; }

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

const roleStyles: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-indigo-100 text-indigo-700',
  EDITOR: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

const roleOptions = [
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function Members() {
  const { user, organization } = useAuth();
  const currentUser = user as UserWithRole | null;
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const fetchData = async () => {
    try { const d = await api('/api/auth/members'); setMembers(d.members); } catch { /* ignore */ }
    try { const d = await api('/api/invitations'); setInvitations(d.invitations); } catch { /* ignore */ }
    try { const d = await api('/api/teams'); setTeams(d.teams); } catch { /* ignore */ }
  };

  useEffect(() => { fetchData(); }, [organization?.id]);

  const memberTeamMap: Record<string, string[]> = {};
  teams.forEach((t) => t.members.forEach((m) => {
    if (!memberTeamMap[m.user.id]) memberTeamMap[m.user.id] = [];
    memberTeamMap[m.user.id].push(t.name);
  }));

  const grouped: { teamId: string; teamName: string; members: Member[] }[] = [];
  const assigned = new Set<string>();
  teams.forEach((t) => {
    const tm = members.filter((m) => memberTeamMap[m.id]?.includes(t.name));
    tm.forEach((m) => assigned.add(m.id));
    if (tm.length > 0) grouped.push({ teamId: t.id, teamName: t.name, members: tm });
  });
  const unassigned = members.filter((m) => !assigned.has(m.id));
  if (unassigned.length > 0) grouped.push({ teamId: '', teamName: 'Unassigned', members: unassigned });

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const data = await api('/api/invitations', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      setInviteLink(data.inviteLink); setInviteEmail(''); fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to invite'); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try { await api(`/api/auth/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) }); fetchData(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to change role'); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    try { await api(`/api/auth/members/${userId}`, { method: 'DELETE' }); fetchData(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to remove member'); }
  };

  const handleCreateTeam = async (e: FormEvent) => {
    e.preventDefault();
    try { await api('/api/teams', { method: 'POST', body: JSON.stringify({ name: newTeamName }) }); setNewTeamName(''); setShowCreateTeam(false); fetchData(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to create team'); }
  };

  const handleAddToTeam = async (userId: string, teamId: string, currentTeamId?: string) => {
    try {
      if (currentTeamId) {
        await api(`/api/teams/${currentTeamId}/members/${userId}`, { method: 'DELETE' });
      }
      await api(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role: 'MEMBER' }) });
      fetchData();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to move member'); }
  };

  const copyLink = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 mt-1">{organization?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              <Building2 className="w-4 h-4" /> Create Team
            </button>
          )}
          {canManage && (
            <button onClick={() => { setShowInvite(!showInvite); setInviteLink(''); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
          )}
        </div>
      </div>

      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreateTeam(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-gray-900 mb-4">Create Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">Create</button>
            </form>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Invite a team member</h2>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
            <div className="flex gap-3">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
              <Select value={inviteRole} onChange={setInviteRole} options={roleOptions} size="md" />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700">Send</button>
            </div>
          </form>
          {inviteLink && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
              <span className="text-sm text-gray-600 flex-1 truncate">{inviteLink}</span>
              <button onClick={copyLink} className="text-indigo-600 hover:text-indigo-700 shrink-0">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {grouped.map((g) => (
          <div key={g.teamId || 'unassigned'} className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                {g.teamId ? <Building2 className="w-4 h-4 text-indigo-500" /> : <Users className="w-4 h-4 text-gray-400" />}
                {g.teamName}
                <span className="text-xs text-gray-400 font-normal">({g.members.length})</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {g.members.map((member) => {
                const isLead = teams.find((t) => t.id === g.teamId)?.members?.find((m) => m.user.id === member.id)?.role === 'LEAD';
                return (
                  <div key={member.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{member.name}{isLead && <span className="text-xs text-amber-600 ml-1">(Team Lead)</span>}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canManage && member.role !== 'SUPER_ADMIN' ? (
                        <>
                          <Select value={member.role} onChange={(val) => handleRoleChange(member.id, val)} options={roleOptions} />
                          <Select
                            value=""
                            onChange={(val) => { if (val) handleAddToTeam(member.id, val, g.teamId || undefined); }}
                            options={[
                              { value: '', label: 'Move', disabled: true },
                              ...(g.teamId
                                ? teams.filter((t) => t.name !== g.teamName)
                                : teams
                              ).map((t) => ({ value: t.id, label: t.name })),
                            ]}
                          />
                          {currentUser?.id !== member.id && (
                            <button onClick={() => handleRemove(member.id, member.name)} className="text-xs text-red-600 hover:text-red-700 font-medium px-1.5 py-1">Remove</button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleStyles[member.role] || 'bg-gray-100 text-gray-700'}`}>
                            {member.role === 'SUPER_ADMIN' && <Shield className="w-3 h-3 inline mr-1" />}
                            {member.role.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {invitations.filter((i) => !i.acceptedAt).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Users className="w-4 h-4" /> Pending Invitations ({invitations.filter((i) => !i.acceptedAt).length})
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {invitations.filter((i) => !i.acceptedAt).map((inv) => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{inv.email}</p>
                  <p className="text-xs text-gray-500">Invited as {inv.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Pending</span>
                  {canManage && (
                    <button onClick={async () => { try { await api(`/api/invitations/${inv.id}`, { method: 'DELETE' }); fetchData(); } catch (err) { alert(err instanceof Error ? err.message : 'Failed to cancel'); } }} className="text-xs text-red-600 hover:text-red-700 font-medium px-2">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
