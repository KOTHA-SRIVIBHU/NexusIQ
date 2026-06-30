import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authApi, type AuthResponse } from '../lib/api';

export interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface OrgInfo {
  id: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: UserWithRole | null;
  organization: OrgInfo | null;
  organizations: OrgInfo[];
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, orgName: string) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => Promise<void>;
}

function parseToken(token: string): { role?: string; organizationId?: string } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { role: payload.role, organizationId: payload.organizationId };
  } catch {
    return {};
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [organizations, setOrganizations] = useState<OrgInfo[]>([]);
  const [organization, setOrganization] = useState<OrgInfo | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexusiq_token'));
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = useCallback((newToken: string) => {
    const tokenData = parseToken(newToken);
    localStorage.setItem('nexusiq_token', newToken);
    setToken(newToken);
    return tokenData;
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('nexusiq_token');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await authApi.me();
      const orgs: OrgInfo[] = data.organizations || [];
      setOrganizations(orgs);
      setUser({ ...data.user });

      const tokenData = parseToken(stored);
      const currentOrg = orgs.find((o: OrgInfo) => o.id === tokenData.organizationId) || orgs[0];
      if (currentOrg) {
        setOrganization({ id: currentOrg.id, name: currentOrg.name, role: currentOrg.role });
        setUser((prev) => prev ? { ...prev, role: currentOrg.role } : null);
      }
    } catch {
      localStorage.removeItem('nexusiq_token');
      setToken(null);
      setUser(null);
      setOrganizations([]);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) refreshUser();
    else setIsLoading(false);
  }, [token, refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    const tokenData = applyToken(data.token);
    setUser({ ...data.user, role: tokenData.role });
    setOrganizations([data.organization]);
    setOrganization({ ...data.organization, role: tokenData.role || '' });
  };

  const register = async (email: string, password: string, name: string, orgName: string) => {
    const data = await authApi.register({ email, password, name, organizationName: orgName });
    const tokenData = applyToken(data.token);
    setUser({ ...data.user, role: tokenData.role });
    setOrganizations([data.organization]);
    setOrganization({ ...data.organization, role: tokenData.role || '' });
  };

  const logout = () => {
    localStorage.removeItem('nexusiq_token');
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setOrganization(null);
  };

  const switchOrganization = async (orgId: string) => {
    const stored = localStorage.getItem('nexusiq_token');
    if (!stored) return;

    const res = await fetch('/api/auth/switch-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stored}` },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to switch organization');
    }

    const data = await res.json();
    applyToken(data.token);
    const targetOrg = organizations.find((o) => o.id === orgId) || data.organization;
    setOrganization({ id: targetOrg.id, name: targetOrg.name, role: targetOrg.role });
    setUser((prev) => prev ? { ...prev, role: targetOrg.role } : null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, organizations, token, isLoading, login, register, logout, switchOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
