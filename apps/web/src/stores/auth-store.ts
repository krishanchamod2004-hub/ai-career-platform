import { create } from 'zustand';
import type { User } from '@ai-career/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setInitialized: (value: boolean) => void;
  clearAuth: () => void;
}

/**
 * Holds the access token and current user in memory only (never localStorage) —
 * the refresh token lives solely in the httpOnly cookie set by the API.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isInitialized: false,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setInitialized: (value) => set({ isInitialized: value }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
