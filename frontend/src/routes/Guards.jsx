import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { FullPageLoader } from '@/components/ui/Feedback';

/* UI-level guards only. The API enforces authentication and roles on every request. */

export function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Checking your session" />;
  if (status !== 'authenticated') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children || <Outlet />;
}

export function AdminRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Checking your session" />;
  if (status !== 'authenticated') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (role !== 'admin') return <Navigate to="/forbidden" replace />;
  return children || <Outlet />;
}

export function GuestRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') {
    const redirect = new URLSearchParams(location.search).get('redirect');
    // Only allow same-site relative redirects.
    const safe = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={safe} replace />;
  }
  return children || <Outlet />;
}
