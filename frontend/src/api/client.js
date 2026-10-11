import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Central Axios instance.
 * - The access token lives only in memory (zustand store), never in localStorage.
 * - The refresh token is an HttpOnly cookie the browser sends to /api/auth/* (withCredentials).
 * - `X-Requested-With` is the CSRF header the API requires on cookie-authenticated endpoints.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

/* A bare instance for the refresh call itself, so it never re-enters the interceptors. */
const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

let refreshPromise = null;

/**
 * Single-flight refresh: concurrent 401s share one /auth/refresh request, so a burst of
 * expired requests never triggers multiple rotations (which the API would treat as reuse).
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then(({ data }) => {
        useAuthStore.getState().setSession(data.data.user, data.data.accessToken);
        return data.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'];
let onSessionExpired = () => {};
/** Registered by the app shell to clear caches and redirect when the session can't be renewed. */
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const hadSession = Boolean(useAuthStore.getState().accessToken);

    const retryable = status === 401 && original && !original._retry && !NO_RETRY.some((u) => original.url?.startsWith(u));
    if (retryable && hadSession && code !== 'ACCOUNT_DISABLED') {
      original._retry = true;
      try {
        const token = await refreshSession();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearSession();
        onSessionExpired();
      }
    } else if (status === 401 && code === 'ACCOUNT_DISABLED' && hadSession) {
      useAuthStore.getState().clearSession();
      onSessionExpired('disabled');
    }
    return Promise.reject(error);
  },
);

/** Extracts a friendly message from any API/network error. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
  if (!error.response) return 'We can’t reach the server right now. Please check your internet connection.';
  const data = error.response.data;
  if (data?.details?.length && data.code === 'VALIDATION_ERROR') return data.details[0].message;
  return data?.message || fallback;
}

/** Maps API validation details onto react-hook-form fields. */
export function applyServerErrors(error, setError) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return false;
  details.forEach((d) => d.field && setError(d.field, { type: 'server', message: d.message }));
  return details.length > 0;
}

/** Unwraps `{ success, data }` envelopes. */
export const unwrap = (promise) => promise.then((r) => r.data.data);
