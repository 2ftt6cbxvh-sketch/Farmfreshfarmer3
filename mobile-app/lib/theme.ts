import { create } from 'zustand';

type ThemeMode = 'dark' | 'light';

interface ThemeStore {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'dark', // default to dark pitch black
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setTheme: (mode) => set({ theme: mode }),
}));
