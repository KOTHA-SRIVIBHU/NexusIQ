import { useState, useEffect } from 'react';
import { useAuth, type UserWithRole } from '../context/AuthContext';
import { ClipboardList, Check, X, UserPlus, Shield, Clock, Send, AlertCircle, History } from 'lucide-react';
import Select from '../components/Select';

interface TeamRequest {
  id: string; status: string; reason: string; createdAt: string; expiresAt: string;
  user: { id: string; name: string; email: string };
  fromTeam: { id: string; name: string } | null;
  toTeam: { id: string; name: string };
  admin: { id: string; name: string } | null;
}

interface RoleRequest {
  id: string; status: string; currentRole: string; requestedRole: string; reason: string; createdAt: string; expiresAt: string;
  user: { id: string; name: string; email: string };
  admin: { id: string; name: string } | null;
}

interface Team { id: string; name: string; }

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

const statusStyle = (s: string) =>
  s === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
  s === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const d = new Date(expiresAt);
  const expired = d < new Date();
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${expired ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
      {expired ? 'Expired' : `Exp ${d.toLocaleDateString()}`}
    </span>
  );
}

export default function Requests() {
  const currentUser = useAuth().user as UserWithRole | null;
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [tab, setTab] = useState<'team' | 'role'>('team');
  const [showHistory, setShowHistory] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  /* ── modals ── */
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamReqTeam, setTeamReqTeam] = useState('');
  const [teamReqReason, setTeamReqReason] = useState('');
  const [teamReqError, setTeamReqError] = useState('');
  const [teamReqLoading, setTeamReqLoading] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleReqRole, setRoleReqRole] = useState('EDITOR');
  const [roleReqReason, setRoleReqReason] = useState('');
  const [roleReqError, setRoleReqError] = useState('');
  const [roleReqLoading, setRoleReqLoading] = useState(false);

  const [denyReason, setDenyReason] = useState('');
  const [denyTarget, setDenyTarget] = useState<{ type: 'team' | 'role'; id: string } | null>(null);

  const fetchAll = async () => {
    try { const d = await api('/api/team-requests'); setTeamRequests(d.requests); } catch { /* ignore */ }
    try { const d = await api('/api/role-requests'); setRoleRequests(d.requests); } catch { /* ignore */ }
    try { const d = await api('/api/teams'); setTeams(d.teams); } catch { /* ignore */ }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleTeamApprove = async (id: string) => {
    try { await api(`/api/team-requests/${id}/approve`, { method: 'PATCH' }); fetchAll(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleTeamDeny = async (id: string) => {
    try {
      await api(`/api/team-requests/${id}/deny`, { method: 'PATCH', body: JSON.stringify({ reason: denyReason || '' }) });
      setDenyTarget(null); setDenyReason(''); fetchAll();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleRoleApprove = async (id: string) => {
    try { await api(`/api/role-requests/${id}/approve`, { method: 'PATCH' }); fetchAll(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleRoleDeny = async (id: string) => {
    try {
      await api(`/api/role-requests/${id}/deny`, { method: 'PATCH', body: JSON.stringify({ reason: denyReason || '' }) });
      setDenyTarget(null); setDenyReason(''); fetchAll();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const submitTeamRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setTeamReqError(''); setTeamReqLoading(true);
    if (!teamReqTeam) { setTeamReqError('Please select a team'); setTeamReqLoading(false); return; }
    try {
      await api('/api/team-requests', { method: 'POST', body: JSON.stringify({ toTeamId: teamReqTeam, reason: teamReqReason }) });
      setShowTeamModal(false); setTeamReqTeam(''); setTeamReqReason(''); fetchAll();
    } catch (err) { setTeamReqError(err instanceof Error ? err.message : 'Failed'); }
    finally { setTeamReqLoading(false); }
  };

  const submitRoleRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setRoleReqError(''); setRoleReqLoading(true);
    try {
      await api('/api/role-requests', { method: 'POST', body: JSON.stringify({ requestedRole: roleReqRole, reason: roleReqReason }) });
      setShowRoleModal(false); setRoleReqRole('EDITOR'); setRoleReqReason(''); fetchAll();
    } catch (err) { setRoleReqError(err instanceof Error ? err.message : 'Failed'); }
    finally { setRoleReqLoading(false); }
  };

  const pendingTeamRequests = teamRequests.filter((r) => r.status === 'PENDING');
  const historyTeamRequests = teamRequests.filter((r) => r.status !== 'PENDING');
  const pendingRoleRequests = roleRequests.filter((r) => r.status === 'PENDING');
  const historyRoleRequests = roleRequests.filter((r) => r.status !== 'PENDING');

  function RequestCard({ req, type, isAdmin: ia }: { req: TeamRequest | RoleRequest; type: 'team' | 'role'; isAdmin: boolean }) {
    const isTeam = type === 'team';
    const r = req as TeamRequest;
    const rr = req as RoleRequest;
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isTeam ? 'bg-indigo-50' : 'bg-purple-50'}`}>
              {isTeam ? <UserPlus className="w-4 h-4 text-indigo-600" /> : <Shield className="w-4 h-4 text-purple-600" />}
            </div>
            <div className="min-w-0">
              {isTeam ? (
                <>
                  <p className="font-medium text-gray-900 text-sm">
                    <span className="font-semibold">{r.user.name}</span>
                    {r.fromTeam ? ` from ${r.fromTeam.name}` : ''} → <span className="font-semibold">{r.toTeam.name}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.user.email}</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900 text-sm">
                    <span className="font-semibold">{rr.user.name}</span> requested <span className="font-semibold">{rr.requestedRole}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{rr.user.email}</p>
                </>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                {req.expiresAt && <ExpiryBadge expiresAt={req.expiresAt} />}
                {!isTeam && (
                  <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{(rr as RoleRequest).currentRole} → {(rr as RoleRequest).requestedRole}</span>
                )}
              </div>
              {req.reason && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg px-3 py-2 italic">"{req.reason}"</p>}
              {req.admin && <p className="text-[11px] text-gray-400 mt-1.5">Reviewed by {req.admin.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(req.status)}`}>
              {req.status === 'PENDING' ? 'Pending' : req.status === 'APPROVED' ? 'Approved' : 'Denied'}
            </span>
            {ia && req.status === 'PENDING' && (
              <div className="flex gap-1">
                <button onClick={() => isTeam ? handleTeamApprove(r.id) : handleRoleApprove(rr.id)}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve"><Check className="w-4 h-4" /></button>
                <button onClick={() => setDenyTarget({ type: isTeam ? 'team' : 'role', id: req.id })}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deny"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
          <p className="text-gray-500 mt-1">Team changes and role upgrades</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTeamModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors shadow-sm">
            <UserPlus className="w-4 h-4" /> Request Team Change
          </button>
          <button onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors shadow-sm">
            <Shield className="w-4 h-4" /> Request Role Upgrade
          </button>
        </div>
      </div>

      {isAdmin && (teamRequests.filter((r) => r.status === 'PENDING').length > 0 || roleRequests.filter((r) => r.status === 'PENDING').length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            {teamRequests.filter((r) => r.status === 'PENDING').length} pending team change{teamRequests.filter((r) => r.status === 'PENDING').length !== 1 ? 's' : ''} and {roleRequests.filter((r) => r.status === 'PENDING').length} pending role upgrade{roleRequests.filter((r) => r.status === 'PENDING').length !== 1 ? 's' : ''} need your review.
          </p>
        </div>
      )}

      {/* tab bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setTab('team'); setShowHistory(false); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'team' && !showHistory ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Team Changes
          </button>
          <button onClick={() => { setTab('role'); setShowHistory(false); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'role' && !showHistory ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Role Upgrades
          </button>
        </div>
        <button onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${showHistory ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
          <History className="w-4 h-4" /> {showHistory ? 'Active Requests' : 'History'}
        </button>
      </div>

      {/* ── TEAM CHANGE MODAL ── */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowTeamModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg"><UserPlus className="w-4 h-4 text-indigo-600" /></div>
                <h2 className="font-semibold text-gray-900">Request Team Change</h2>
              </div>
              <button onClick={() => setShowTeamModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitTeamRequest} className="space-y-4">
              {teamReqError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{teamReqError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Team</label>
                <Select
                  value={teamReqTeam}
                  onChange={setTeamReqTeam}
                  options={[
                    { value: '', label: 'Select a team...', disabled: true },
                    ...teams.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  size="md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason (optional)</label>
                <textarea value={teamReqReason} onChange={(e) => setTeamReqReason(e.target.value)} rows={3} placeholder="Why do you want to switch teams?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={teamReqLoading}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5 transition-colors">
                  <Send className="w-3.5 h-3.5" /> {teamReqLoading ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowTeamModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ROLE UPGRADE MODAL ── */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowRoleModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 rounded-lg"><Shield className="w-4 h-4 text-purple-600" /></div>
                <h2 className="font-semibold text-gray-900">Request Role Upgrade</h2>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitRoleRequest} className="space-y-4">
              {roleReqError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{roleReqError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Requested Role</label>
                <Select
                  value={roleReqRole}
                  onChange={setRoleReqRole}
                  options={[
                    { value: 'EDITOR', label: 'Editor' },
                    { value: 'ADMIN', label: 'Admin' },
                  ]}
                  size="md"
                />
                <div className="mt-2 space-y-1">
                  <div className={`text-xs px-3 py-1.5 rounded-lg border ${roleReqRole === 'EDITOR' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400'}`}>
                    <span className="font-medium">Editor</span> — Create and edit content
                  </div>
                  <div className={`text-xs px-3 py-1.5 rounded-lg border ${roleReqRole === 'ADMIN' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400'}`}>
                    <span className="font-medium">Admin</span> — Full management access
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Your current role: <span className="font-medium text-gray-600">{currentUser?.role?.replace('_', ' ') || 'VIEWER'}</span></p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason (optional)</label>
                <textarea value={roleReqReason} onChange={(e) => setRoleReqReason(e.target.value)} rows={3} placeholder="Why do you need this role?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={roleReqLoading}
                  className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5 transition-colors">
                  <Send className="w-3.5 h-3.5" /> {roleReqLoading ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DENY REASON MODAL ── */}
      {denyTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setDenyTarget(null); setDenyReason(''); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Deny Request</h2>
              <button onClick={() => { setDenyTarget(null); setDenyReason(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason (optional)</label>
                <textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} rows={3} placeholder="Optional reason for denial..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => denyTarget.type === 'team' ? handleTeamDeny(denyTarget.id) : handleRoleDeny(denyTarget.id)}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 text-sm transition-colors">Deny</button>
                <button onClick={() => { setDenyTarget(null); setDenyReason(''); }} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE PENDING REQUESTS ── */}
      {!showHistory && (
        <div className="space-y-3">
          {tab === 'team' ? (
            pendingTeamRequests.length === 0
              ? <p className="text-gray-400 text-center py-12 text-sm">No pending team change requests.</p>
              : pendingTeamRequests.map((req) => <RequestCard key={req.id} req={req} type="team" isAdmin={isAdmin} />)
          ) : (
            pendingRoleRequests.length === 0
              ? <p className="text-gray-400 text-center py-12 text-sm">No pending role upgrade requests.</p>
              : pendingRoleRequests.map((req) => <RequestCard key={req.id} req={req} type="role" isAdmin={isAdmin} />)
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {showHistory && (
        <div>
          {(tab === 'team' ? historyTeamRequests : historyRoleRequests).length === 0 ? (
            <p className="text-gray-400 text-center py-12 text-sm">No history yet.</p>
          ) : (
            <div className="space-y-3">
              {(tab === 'team' ? historyTeamRequests : historyRoleRequests).map((req) => (
                <RequestCard key={req.id} req={req} type={tab} isAdmin={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
