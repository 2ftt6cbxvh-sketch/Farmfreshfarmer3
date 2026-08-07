import { create } from 'zustand';
import { tokenStorage } from './storage';

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
  logout: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    await tokenStorage.clearAll();
    set({ user: null });
  },
}));
