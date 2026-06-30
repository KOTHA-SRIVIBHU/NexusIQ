import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, CheckCircle } from 'lucide-react';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { user: currentUser, login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    email: string;
    organizationName: string;
    role: string;
    hasAccount: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      return;
    }

    fetch(`/api/invitations/resolve?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Invalid invitation');
        }
        return res.json();
      })
      .then((data) => {
        setInvite(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, string> = { token };
      if (!invite?.hasAccount) {
        if (!name || !password) {
          setError('Name and password are required');
          setSubmitting(false);
          return;
        }
        body.name = name;
        body.password = password;
      }

      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to accept invitation');
      }

      const data = await res.json();
      localStorage.setItem('nexusiq_token', data.token);
      setAccepted(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
            Create a workspace instead
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome aboard!</h1>
          <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Case 1: User is already logged in with the same email — just accept
  const isSameUser = currentUser?.email === invite?.email;

  if (isSameUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join {invite?.organizationName}</h1>
          <p className="text-gray-500 mb-2">You've been invited as <span className="font-medium text-indigo-600">{invite?.role}</span></p>
          <p className="text-gray-400 text-sm mb-6">{invite?.email}</p>

          <button
            onClick={handleAccept}
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    );
  }

  // Case 2: User has an account but is not logged in
  if (invite?.hasAccount) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join {invite?.organizationName}</h1>
          <p className="text-gray-500 mb-2">You've been invited as <span className="font-medium text-indigo-600">{invite?.role}</span></p>
          <p className="text-gray-400 text-sm mb-6">{invite?.email}</p>

          <div className="bg-yellow-50 text-yellow-700 text-sm p-3 rounded-lg mb-4">
            You already have an account. Sign in first, then click the invite link again.
          </div>

          <Link
            to={`/login?redirect=/accept-invite?token=${token}`}
            className="block w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign in to accept
          </Link>
        </div>
      </div>
    );
  }

  // Case 3: New user — show registration form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join {invite?.organizationName}</h1>
          <p className="text-gray-500 mt-1">You've been invited as <span className="font-medium text-indigo-600">{invite?.role}</span></p>
          <p className="text-gray-400 text-sm mt-1">{invite?.email}</p>
        </div>

        <form onSubmit={handleAccept} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Create Account & Join'}
          </button>
        </form>
      </div>
    </div>
  );
}
