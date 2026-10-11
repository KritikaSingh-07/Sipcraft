import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { CountUp } from '@/components/ui/Effects';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];

/** Page header shared by every account page. */
export function DashHeader({ icon: Icon, eyebrow, title, accent, description, action, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-5', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="eyebrow inline-flex items-center gap-2.5">
            {Icon && (
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-3.5 w-3.5" />
              </span>
            )}
            {eyebrow}
          </motion.p>
        )}
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05, ease: EASE }} className="display mt-3 text-4xl sm:text-5xl">
          {title} {accent && <span className="serif-accent text-brand">{accent}</span>}
        </motion.h1>
        {description && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 max-w-xl text-[15px] leading-7 text-muted">
            {description}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          {action}
        </motion.div>
      )}
    </div>
  );
}

/** Rounded glassy section card with an optional titled header row. */
export function Panel({ title, icon: Icon, description, action, children, className, bodyClassName, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={cn('relative overflow-hidden rounded-[1.75rem] border border-line bg-surface/90 shadow-soft backdrop-blur', className)}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-ink">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-bold tracking-tight">{title}</h2>
              {description && <p className="text-[13px] text-muted">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-6 sm:p-7', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

const TONES = {
  brand: 'from-brand to-brand-tint text-white',
  warning: 'from-[#e7a33e] to-[#f5cf7c] text-white',
  success: 'from-[#2f8f5b] to-[#7ccf9e] text-white',
  rose: 'from-[#e2557a] to-[#f3a9bd] text-white',
  ink: 'from-ink to-ink-soft text-white',
};

/** Animated KPI tile with a pointer-following glow. */
export function StatTile({ icon: Icon, label, value, prefix = '', suffix = '', tone = 'brand', to, hint }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const glow = useTransform([x, y], ([a, b]) => `radial-gradient(240px circle at ${a}px ${b}px, rgba(109,91,208,0.12), transparent 60%)`);
  const body = (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        x.set(-200);
        y.set(-200);
      }}
      className="group relative h-full overflow-hidden rounded-[1.5rem] border border-line bg-surface p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <div className="relative flex items-start justify-between">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-soft transition duration-500 group-hover:rotate-[-8deg] group-hover:scale-110', TONES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {to && <ArrowUpRight className="h-4 w-4 text-subtle transition duration-300 group-hover:rotate-45 group-hover:text-ink" />}
      </div>
      <p className="relative mt-5 text-3xl font-extrabold tracking-tight">
        {prefix}
        {typeof value === 'number' ? <CountUp to={value} suffix={suffix} /> : value}
      </p>
      <p className="relative mt-1 text-sm text-muted">{label}</p>
      {hint && <p className="relative mt-2 text-xs text-subtle">{hint}</p>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-[1.5rem]">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Sliding-pill tab bar. `tabs` is [[value, label, count?]]. */
export function PillTabs({ tabs, value, onChange, id, className }) {
  return (
    <div role="tablist" className={cn('scrollbar-none flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/80 p-1.5 backdrop-blur sm:w-fit', className)}>
      {tabs.map(([v, label, count]) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn('relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors', value === v ? 'text-white' : 'text-ink-soft hover:text-ink')}
        >
          {value === v && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
          <span className="relative inline-flex items-center gap-1.5">
            {label}
            {count > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-bold', value === v ? 'bg-white/20' : 'bg-brand-soft text-brand')}>{count}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
