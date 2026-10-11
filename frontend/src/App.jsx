import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import AppRoutes from '@/routes/AppRoutes';
import AuthBootstrap from '@/routes/AuthBootstrap';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ConfirmProvider } from '@/contexts/ConfirmContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const status = error?.response?.status;
        if (status && status < 500) return false; // don't retry 4xx
        return count < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* "user" respects the OS prefers-reduced-motion setting for every framer-motion animation */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <ConfirmProvider>
              <AuthBootstrap>
                <AppRoutes />
              </AuthBootstrap>
            </ConfirmProvider>
          </BrowserRouter>
          <Toaster
            position="bottom-center"
            offset={24}
            toastOptions={{
              classNames: {
                toast: '!rounded-2xl !border-line !bg-ink !text-white !shadow-lift !font-sans',
                description: '!text-white/70',
                success: '[&_[data-icon]]:!text-brand-tint',
                error: '[&_[data-icon]]:!text-[#ff8a8a]',
              },
            }}
          />
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
