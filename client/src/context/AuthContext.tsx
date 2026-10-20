import React, { createContext, useContext, useEffect, useState } from 'react';
import { PublicUser } from '@maestro/shared';
import { api, setAuthToken } from '../services/api/client';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user, token } = await api.auth.login(email, password);
    setAuthToken(token);
    setUser(user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { user, token } = await api.auth.register(name, email, password);
    setAuthToken(token);
    setUser(user);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
