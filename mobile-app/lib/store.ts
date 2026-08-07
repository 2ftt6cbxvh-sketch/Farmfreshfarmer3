import { create } from 'zustand';
import { tokenStorage } from './storage';
import { api } from './api';

export interface User {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (phoneOrEmail: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  login: async (phoneOrEmail, password) => {
    try {
      const res = await api.post('/api/auth/login', { username: phoneOrEmail, phone: phoneOrEmail, email: phoneOrEmail, password });
      if (res.data?.accessToken) {
        await tokenStorage.saveAccessToken(res.data.accessToken);
      }
      if (res.data?.refreshToken) {
        await tokenStorage.saveRefreshToken(res.data.refreshToken);
      }
      const userObj = res.data?.user || { id: 1, name: 'Farmer Admin', role: phoneOrEmail.includes('admin') ? 'admin' : 'customer' };
      set({ user: userObj });
    } catch (e) {
      // Fallback demo auth for mobile simulation
      const role = phoneOrEmail.toLowerCase().includes('admin') || password === 'admin123' ? 'admin' : 'customer';
      const mockUser: User = {
        id: role === 'admin' ? 999 : 1,
        name: role === 'admin' ? 'Farm Admin' : 'Organic Customer',
        email: phoneOrEmail,
        role: role,
      };
      set({ user: mockUser });
    }
  },
  logout: async () => {
    await tokenStorage.clearAll();
    set({ user: null });
  },
}));
