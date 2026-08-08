import { create } from 'zustand';
import { tokenStorage } from './storage';
import { api } from './api';

export interface User {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimaryAdmin?: boolean;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  login: async (identifier, password) => {
    let res;
    try {
      res = await api.post('/api/auth/login', { username: identifier, email: identifier, phone: identifier, password });
    } catch {
      res = await api.post('/api/login', { email: identifier, password });
    }
    if (res.data?.accessToken) {
      await tokenStorage.saveAccessToken(res.data.accessToken);
    }
    if (res.data?.refreshToken) {
      await tokenStorage.saveRefreshToken(res.data.refreshToken);
    }
    const userObj = res.data?.user || res.data;
    set({ user: userObj });
  },
  logout: async () => {
    await tokenStorage.clearAll();
    set({ user: null });
  },
}));
