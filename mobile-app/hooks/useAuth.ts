import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const loadUser = useCallback(async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) { setState({ user: null, isLoading: false, isAuthenticated: false }); return; }
      const res = await api.get('/api/me');
      setState({ user: res.data, isLoading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password, platform: 'android' });
    await tokenStorage.saveAccessToken(res.data.accessToken);
    await tokenStorage.saveRefreshToken(res.data.refreshToken);
    setState({ user: res.data.user, isLoading: false, isAuthenticated: true });
    return res.data;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.post('/api/auth/register', { name, email, password, phone, platform: 'android' });
    await tokenStorage.saveAccessToken(res.data.accessToken);
    await tokenStorage.saveRefreshToken(res.data.refreshToken);
    setState({ user: res.data.user, isLoading: false, isAuthenticated: true });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) await api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    } finally {
      await tokenStorage.clearAll();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  return { ...state, login, register, logout, reload: loadUser };
}
