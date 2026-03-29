import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { User } from '@server-panel/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void; // Update user data
  isAdmin: () => boolean;
  isOperator: () => boolean;
  clearAuth: () => void; // For forced logout on auth errors
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: !!localStorage.getItem('token'),

      login: async (username: string, password: string) => {
        const response = await api.login({ username, password });
        api.setToken(response.token);
        set({ user: response.user, isAuthenticated: true });
      },

      logout: () => {
        api.clearToken();
        set({ user: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      setUser: (user: User) => {
        set({ user });
      },

      clearAuth: () => {
        // Called when API returns 401/403
        api.clearToken();
        set({ user: null, isAuthenticated: false });
      },

      isAdmin: () => {
        const state = get();
        return state.user?.role === 'ADMIN';
      },

      isOperator: () => {
        const state = get();
        return state.user?.role === 'OPERATOR' || state.user?.role === 'ADMIN';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
