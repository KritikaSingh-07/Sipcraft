import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refreshSession, setSessionExpiredHandler } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { mergeGuestData } from '@/hooks/useAuth';

/**
 * On first load, silently restores the session from the HttpOnly refresh cookie.
 * Also wires the "session expired" handler used by the Axios interceptor.
 */
export default function AuthBootstrap({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const locRef = useRef(location);
  locRef.current = location;
  const started = useRef(false);

  useEffect(() => {
    setSessionExpiredHandler((reason) => {
      queryClient.clear();
      const here = locRef.current.pathname + locRef.current.search;
      toast.error(reason === 'disabled' ? 'Your account has been disabled.' : 'Your session has expired. Please sign in again.');
      if (!['/login', '/register'].includes(locRef.current.pathname)) {
        navigate(`/login?redirect=${encodeURIComponent(here)}`, { replace: true });
      }
    });
  }, [navigate, queryClient]);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invokes effects in dev
    started.current = true;
    // The API sets a non-secret 'sc_session' hint cookie alongside the HttpOnly refresh cookie.
    // Without it there is no session to restore, so skip the refresh request entirely.
    if (!document.cookie.split('; ').some((c) => c.startsWith('sc_session='))) {
      useAuthStore.getState().clearSession();
      return;
    }
    refreshSession()
      .then(() => mergeGuestData(queryClient))
      .catch(() => useAuthStore.getState().clearSession());
  }, [queryClient]);

  return children;
}
