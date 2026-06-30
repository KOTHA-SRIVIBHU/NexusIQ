import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, type AuthResponse } from '../lib/api';

export interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextValue {
  user: UserWithRole | null;
  organization: AuthResponse['organization'] | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, orgName: string) => Promise<void>;
  logout: () => void;
}

function parseToken(token: string): { role?: string } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { role: payload.role };
  } catch {
    return {};
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [organization, setOrganization] = useState<AuthResponse['organization'] | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexusiq_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const tokenData = parseToken(token);
      authApi.me()
        .then((data) => {
          const org = data.organizations?.[0];
          if (org) {
            setOrganization({ id: org.id, name: org.name });
            setUser({ ...data.user, role: org.role || tokenData.role });
          } else {
            setUser(data.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('nexusiq_token');
          setToken(null);
          setUser(null);
          setOrganization(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    const tokenData = parseToken(data.token);
    localStorage.setItem('nexusiq_token', data.token);
    setToken(data.token);
    setUser({ ...data.user, role: tokenData.role });
    setOrganization(data.organization);
  };

  const register = async (email: string, password: string, name: string, orgName: string) => {
    const data = await authApi.register({ email, password, name, organizationName: orgName });
    const tokenData = parseToken(data.token);
    localStorage.setItem('nexusiq_token', data.token);
    setToken(data.token);
    setUser({ ...data.user, role: tokenData.role });
    setOrganization(data.organization);
  };

  const logout = () => {
    localStorage.removeItem('nexusiq_token');
    setToken(null);
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
