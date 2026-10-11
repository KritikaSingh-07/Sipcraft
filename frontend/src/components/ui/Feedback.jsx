import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import Button from './Button';
import { cn } from '@/utils/cn';

export function Skeleton({ className, ...props }) {
  return <div className={cn('skeleton', className)} aria-hidden {...props} />;
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={cn('inline-flex items-center', className)}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="h-12 w-8 rounded-b-xl rounded-t-md bg-gradient-to-b from-brand-tint to-brand"
          animate={{ scaleY: [1, 0.86, 1], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <span className="text-sm font-medium text-muted">{label}…</span>
      </div>
    </div>
  );
}

const tones = {
  neutral: 'bg-sand text-ink-soft',
  brand: 'bg-brand-soft text-brand-dark',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  dark: 'bg-ink text-white',
};

export function Badge({ tone = 'neutral', className, children, dot }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Polished empty state with an illustration slot, copy and an optional action. */
export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-10' : 'px-6 py-16 sm:py-20', className)}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 scale-150 rounded-full bg-brand-soft blur-2xl" aria-hidden />
        <div className="relative grid h-20 w-20 place-items-center rounded-[1.75rem] border border-line bg-surface shadow-soft">
          {Icon && <Icon className="h-8 w-8 text-brand" strokeWidth={1.6} aria-hidden />}
        </div>
      </div>
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[15px] leading-6 text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </motion.div>
  );
}

/** Network / API error block with retry. */
export function ErrorState({ error, onRetry, title, className }) {
  const offline = error && !error.response;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)} role="alert">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-danger-soft text-danger">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="text-lg font-bold">{title || (offline ? 'You appear to be offline' : 'We couldn’t load this')}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        {offline ? 'Check your internet connection and try again.' : error?.response?.data?.message || 'Something went wrong on our side. Please try again.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
    </div>
  );
}
