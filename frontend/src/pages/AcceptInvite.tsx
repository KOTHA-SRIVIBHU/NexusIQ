import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, CheckCircle, LogIn, UserPlus } from 'lucide-react';

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

  // Registration fields (new user)
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  // Login fields (existing user, not logged in)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

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
        setLoginEmail(data.email);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e?: FormEvent) => {
    e?.preventDefault();
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

  const handleLoginThenAccept = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      await login(loginEmail, loginPassword);
      setIsLoggingIn(false);
      setShowLoginForm(false);
    } catch (err) {
      setIsLoggingIn(false);
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !invite) {
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
          <p className="text-gray-500 text-sm">You're now a member of <strong>{invite?.organizationName}</strong></p>
          <p className="text-gray-400 text-xs mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Case: Logged in but email doesn't match the invite
  if (currentUser && currentUser.email !== invite?.email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Wrong Account</h1>
          <p className="text-gray-500 text-sm mb-2">
            This invitation was sent to <strong>{invite?.email}</strong>
          </p>
          <p className="text-gray-400 text-sm mb-4">
            You're currently logged in as <strong>{currentUser.email}</strong>
          </p>
          <Link
            to="/login"
            className="block w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    );
  }

  // Case 1: Logged in, email matches — just show Accept button
  if (currentUser && currentUser.email === invite?.email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Join {invite?.organizationName}</h1>
          <p className="text-gray-500 mb-4">
            You've been invited as <span className="font-medium text-indigo-600">{invite?.role?.replace('_', ' ')}</span>
          </p>

          <button
            onClick={() => handleAccept()}
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 text-lg"
          >
            {submitting ? 'Joining...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Has account but not logged in — show inline login
  if (invite?.hasAccount && !showLoginForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Join {invite.organizationName}</h1>
            <p className="text-gray-500">
              Invited as <span className="font-medium text-indigo-600">{invite.role.replace('_', ' ')}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">{invite.email}</p>
          </div>

          <button
            onClick={() => setShowLoginForm(true)}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-lg"
          >
            <LogIn className="w-5 h-5" />
            Sign in to accept
          </button>
        </div>
      </div>
    );
  }

  // Inline login form
  if (invite?.hasAccount && showLoginForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Join {invite.organizationName}</h1>
            <p className="text-gray-500 text-sm mb-1">Invited as {invite.role.replace('_', ' ')}</p>
            <p className="text-gray-400 text-xs">{invite.email}</p>
          </div>

          <form onSubmit={handleLoginThenAccept} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign in & Accept'}
            </button>
            <button
              type="button"
              onClick={() => setShowLoginForm(false)}
              className="w-full text-gray-500 text-sm hover:text-gray-700"
            >
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Case 3: New user — registration form with pre-filled email
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Join {invite?.organizationName}</h1>
          <p className="text-gray-500">
            Invited as <span className="font-medium text-indigo-600">{invite?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <form onSubmit={handleAccept} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={invite?.email || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
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
              placeholder="At least 6 characters"
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
