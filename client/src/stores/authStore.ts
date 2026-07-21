import { create } from 'zustand';
import { api } from '../services/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authActionLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authActionLoading: false,
  error: null,

  login: async (email, password) => {
    try {
      set({ authActionLoading: true, error: null });
      const data = await api.login(email, password);
      api.setTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, isAuthenticated: true, authActionLoading: false });
    } catch (error: any) {
      set({ error: error.message, authActionLoading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    try {
      set({ authActionLoading: true, error: null });
      const data = await api.register(email, password, name);
      api.setTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, isAuthenticated: true, authActionLoading: false });
    } catch (error: any) {
      set({ error: error.message, authActionLoading: false });
      throw error;
    }
  },

  googleLogin: async (credential) => {
    try {
      set({ authActionLoading: true, error: null });
      const data = await api.googleLogin(credential);
      api.setTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, isAuthenticated: true, authActionLoading: false });
    } catch (error: any) {
      set({ error: error.message, authActionLoading: false });
      throw error;
    }
  },

  logout: () => {
    api.clearTokens();
    localStorage.removeItem('anonymousMessageCount');
    set({ user: null, isAuthenticated: false, isLoading: false, authActionLoading: false });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const data = await api.getMe();
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const isNetworkError = 
        !err.message || 
        err.message === 'Failed to fetch' || 
        err.message.includes('NetworkError') || 
        err.message.includes('network') ||
        err.message.includes('Request failed') ||
        err.message.includes('Failed to execute');

      if (!isNetworkError) {
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      }
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
