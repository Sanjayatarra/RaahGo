import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, saveToken, loadToken, clearToken } from './api';

export type User = {
  id: string;
  phone: string;
  name: string;
  role: 'customer' | 'driver' | 'admin';
  is_online?: boolean;
  vehicle_type?: string;
  total_rides?: number;
  earnings?: number;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await loadToken();
      if (!token) { setUser(null); return; }
      const me = await api('/auth/me');
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, logout, setUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
