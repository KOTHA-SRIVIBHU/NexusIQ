import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, Copy, Check, X, UserPlus, Users } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  inviteLink: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export default function Members() {
  const { organization, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    const token = localStorage.getItem('nexusiq_token');
    const headers = { Authorization: `Bearer ${token}` };

    const [membersRes, invitesRes] = await Promise.all([
      fetch('/api/auth/members', { headers }),
      fetch('/api/invitations', { headers }),
    ]);

    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members);
    }
    if (invitesRes.ok) {
      const data = await invitesRes.json();
      setInvitations(data.invitations);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('nexusiq_token');

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to invite');
      }

      const data = await res.json();
      setInviteLink(data.inviteLink);
      setInviteEmail('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = user && (user as any).role !== 'VIEWER' && (user as any).role !== 'EDITOR';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 mt-1">{organization?.name}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowInvite(!showInvite); setInviteLink(''); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {showInvite && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Invite a team member</h2>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="VIEWER">Viewer</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Send
              </button>
            </div>
          </form>

          {inviteLink && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
              <span className="text-sm text-gray-600 flex-1 truncate">{inviteLink}</span>
              <button onClick={copyLink} className="text-indigo-600 hover:text-indigo-700">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <Users className="w-5 h-5" />
            Team Members ({members.length})
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{member.name}</p>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                member.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                member.role === 'EDITOR' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {member.role.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Users className="w-5 h-5" />
              Pending Invitations ({invitations.length})
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {invitations.filter((i) => !i.acceptedAt).map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{inv.email}</p>
                  <p className="text-sm text-gray-500">Invited as {inv.role}</p>
                </div>
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
