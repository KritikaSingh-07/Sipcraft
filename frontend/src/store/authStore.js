import { create } from 'zustand';

/**
 * Authentication state. The access token is kept in memory only; a page reload restores the
 * session through the HttpOnly refresh cookie (see AuthBootstrap).
 * status: 'loading' (bootstrapping) | 'authenticated' | 'guest'
 */
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set((s) => ({ user: { ...s.user, ...user } })),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null, status: 'guest' }),
}));

export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'admin');
export const useIsAuthenticated = () => useAuthStore((s) => s.status === 'authenticated');
