'use client';

import { create } from 'zustand';
import { api, AuthResponse, getToken } from '@/lib/api';

type User = AuthResponse['user'];

type AuthState = {
  user?: User;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string; company?: string }) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  hydrated: false,
  hydrate: async () => {
    if (getToken()) {
      try {
        const user = await api.me();
        set({ user, hydrated: true });
      } catch {
        window.localStorage.removeItem('token');
        set({ hydrated: true });
      }
    } else {
      set({ hydrated: true });
    }
  },
  login: async (email, password) => {
    const data = await api.login(email, password);
    window.localStorage.setItem('token', data.accessToken);
    set({ user: data.user });
  },
  register: async (payload) => {
    const data = await api.register(payload);
    window.localStorage.setItem('token', data.accessToken);
    set({ user: data.user });
  },
  logout: () => {
    window.localStorage.removeItem('token');
    set({ user: undefined });
  }
}));
