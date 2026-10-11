import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Package, Heart, MapPin, User, KeyRound, Bell, LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useAuthActions } from '@/hooks/useAuth';
import { useUnreadNotifications } from '@/hooks/queries';
import { FullPageLoader } from '@/components/ui/Feedback';
import { initials, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const GROUPS = [
  {
    label: 'Shopping',
    links: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/orders', label: 'My orders', icon: Package },
      { to: '/dashboard/wishlist', label: 'Wishlist', icon: Heart },
      { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/dashboard/profile', label: 'Profile', icon: User },
      { to: '/dashboard/addresses', label: 'Addresses', icon: MapPin },
      { to: '/dashboard/password', label: 'Security', icon: KeyRound },
    ],
  },
];
const LINKS = GROUPS.flatMap((g) => g.links);

/** Share of the profile the customer has filled in. */
export function profileCompletion(user) {
  const checks = [Boolean(user?.name), Boolean(user?.email), Boolean(user?.phone), Boolean(user?.avatar?.url)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function Avatar({ user, className, rounded = 'rounded-2xl' }) {
  return user?.avatar?.url ? (
    <img src={user.avatar.url} alt="" className={cn('object-cover', rounded, className)} />
  ) : (
    <span className={cn('grid place-items-center bg-gradient-to-br from-brand to-[#e2557a] font-bold text-white', rounded, className)}>{initials(user?.name)}</span>
  );
}

function NavItem({ to, label, icon: Icon, end, badge, unread, compact }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors lg:rounded-2xl',
          isActive ? 'text-white' : 'text-ink-soft hover:bg-sand hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId={compact ? 'dash-active-m' : 'dash-active'} className="absolute inset-0 rounded-full bg-ink shadow-lift lg:rounded-2xl" transition={{ type: 'spring', damping: 30, stiffness: 380 }} />}
          <Icon className={cn('relative h-4 w-4 transition-transform duration-300', !isActive && 'group-hover:scale-110 group-hover:-rotate-6')} />
          <span className="relative">{label}</span>
          {badge && unread > 0 && (
            <span className={cn('relative ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold', isActive ? 'bg-white text-ink' : 'bg-brand text-white')}>
              {unread}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: unread } = useUnreadNotifications();
  const count = unread?.unread || 0;
  const completion = profileCompletion(user);

  const signOut = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/');
  };

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div aria-hidden className="aurora-blob -top-40 right-[-10%] h-[420px] w-[420px] animate-aurora bg-brand-tint/70" />
      <div aria-hidden className="aurora-blob top-[40%] left-[-15%] h-[360px] w-[360px] animate-aurora-alt bg-[#f3c8d6]/60" />

      <div className="container-page relative py-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            {/* Profile card (desktop) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-4 hidden overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white lg:block"
            >
              <div aria-hidden className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-brand/50 blur-3xl" />
              <div aria-hidden className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#e2557a]/30 blur-3xl" />
              <div aria-hidden className="grain absolute inset-0" />
              <div className="relative flex items-center gap-3">
                <span className="relative">
                  <Avatar user={user} className="h-14 w-14 text-base ring-2 ring-white/20" />
                  <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-[#7ee2a8]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{user?.name}</p>
                  <p className="truncate text-xs text-white/55">{user?.email}</p>
                </div>
              </div>
              <div className="relative mt-5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-brand-tint" /> Profile {completion}% complete
                  </span>
                  {user?.createdAt && <span>Since {formatDate(user.createdAt, { month: 'short', year: 'numeric' })}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="liquid-fill relative h-full rounded-full bg-gradient-to-r from-brand-tint to-[#f3a9bd]" initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              </div>
            </motion.div>

            {/* Mobile: horizontal pills */}
            <nav aria-label="Account" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
              {LINKS.map((l) => (
                <NavItem key={l.to} {...l} unread={count} compact />
              ))}
              <button onClick={signOut} className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-danger hover:bg-danger-soft">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </nav>

            {/* Desktop: grouped list */}
            <nav aria-label="Account" className="hidden rounded-[1.75rem] border border-line bg-surface/80 p-3 shadow-soft backdrop-blur lg:block">
              {GROUPS.map((g, gi) => (
                <div key={g.label} className={cn(gi > 0 && 'mt-3 border-t border-line pt-3')}>
                  <p className="px-4 pt-1 pb-2 text-[10px] font-bold tracking-[0.2em] text-subtle uppercase">{g.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {g.links.map((l) => (
                      <NavItem key={l.to} {...l} unread={count} />
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={signOut} className="group mt-3 flex w-full items-center gap-3 border-t border-line px-4 pt-4 pb-2.5 text-sm font-semibold text-danger transition hover:text-danger/80">
                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Logout
              </button>
            </nav>
          </aside>

          <div className="min-w-0">
            <Suspense fallback={<FullPageLoader />}>
              <motion.div key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                <Outlet />
              </motion.div>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
