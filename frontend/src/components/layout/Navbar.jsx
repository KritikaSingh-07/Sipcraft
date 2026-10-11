import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Search, Heart, ShoppingBag, User, Menu, LayoutDashboard, Package, Bell, LogOut, ShieldCheck, ChevronDown, Settings } from 'lucide-react';
import { Logo } from './Brand';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuthActions } from '@/hooks/useAuth';
import { useUnreadNotifications, useSettings } from '@/hooks/queries';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { toast } from 'sonner';

export const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/team', label: 'Team' },
  { to: '/contact', label: 'Contact' },
];

function CountBadge({ count, pulseKey }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={pulseKey}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [1.35, 1], opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-canvas"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function IconButton({ label, children, className, ...props }) {
  const Comp = props.to ? Link : 'button';
  return (
    <Comp
      className={cn('relative grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-ink/[0.06]', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Comp>
  );
}

function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/orders', label: 'My orders', icon: Package },
    { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { to: '/dashboard/profile', label: 'Account settings', icon: Settings },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1.5 rounded-full py-1 pr-2 pl-1 transition hover:bg-ink/[0.06]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {user.avatar?.url ? (
          <img src={user.avatar.url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{initials(user.name)}</span>
        )}
        <ChevronDown className={cn('hidden h-3.5 w-3.5 text-muted transition sm:block', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
          >
            <div className="px-3 py-3">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-line" />
            {user.role === 'admin' && (
              <Link role="menuitem" to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-soft">
                <ShieldCheck className="h-4 w-4" /> Admin dashboard
              </Link>
            )}
            {items.map(({ to, label, icon: Icon }) => (
              <Link key={to} role="menuitem" to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
                <Icon className="h-4 w-4 text-muted" /> {label}
              </Link>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              onClick={async () => {
                await logout();
                toast.success('Signed out');
                navigate('/');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

  const status = useAuthStore((s) => s.status);
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { data: unread } = useUnreadNotifications();
  const cartPulse = useUIStore((s) => s.cartPulse);
  const { openSearch, setMobileMenu, openCartDrawer } = useUIStore();

  return (
    <header className={cn('sticky top-0 z-50 transition-colors duration-500', scrolled ? 'bg-transparent' : 'bg-canvas')}>
      {/* Becomes a floating glass pill once you scroll */}
      <motion.div
        initial={false}
        animate={scrolled ? { y: 10, scale: 0.985 } : { y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={cn(
          'mx-auto transition-[max-width,border-radius,background-color,box-shadow,border-color,padding] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
          scrolled ? 'max-w-[1180px] rounded-full border border-white/70 bg-white/70 shadow-[0_12px_40px_-16px_rgb(23_22_28/0.25)] backdrop-blur-xl sm:mx-4 xl:mx-auto' : 'max-w-full border border-transparent',
        )}
      >
      <nav className={cn('container-page flex items-center justify-between gap-4 transition-[height] duration-300', scrolled ? 'h-14 lg:px-6' : 'h-[72px]')} aria-label="Main">
        <div className="flex items-center gap-2 lg:w-56">
          <IconButton label="Open menu" className="-ml-2 lg:hidden" onClick={() => setMobileMenu(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <Logo />
        </div>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) => cn('relative rounded-full px-4 py-2 text-[14px] font-semibold transition-colors', isActive ? 'text-ink' : 'text-muted hover:text-ink')}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-ink/[0.06]" transition={{ type: 'spring', damping: 30, stiffness: 380 }} />}
                    {l.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-0.5 lg:w-56">
          <IconButton label="Search products" onClick={openSearch}>
            <Search className="h-[19px] w-[19px]" />
          </IconButton>
          <IconButton label={`Wishlist${wishCount ? `, ${wishCount} items` : ''}`} to="/wishlist" className="hidden sm:grid">
            <Heart className="h-[19px] w-[19px]" />
            <CountBadge count={wishCount} />
          </IconButton>
          {status === 'authenticated' && (
            <IconButton label={`Notifications${unread?.unread ? `, ${unread.unread} unread` : ''}`} to="/dashboard/notifications" className="hidden sm:grid">
              <Bell className="h-[19px] w-[19px]" />
              <CountBadge count={unread?.unread || 0} />
            </IconButton>
          )}
          <IconButton label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} onClick={openCartDrawer} data-cart-target>
            <motion.span key={cartPulse} animate={cartPulse ? { rotate: [0, -14, 10, -6, 0], scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.6 }}>
              <ShoppingBag className="h-[19px] w-[19px]" />
            </motion.span>
            <CountBadge count={cartCount} pulseKey={cartPulse} />
          </IconButton>
          {status === 'authenticated' ? (
            <div className="ml-1">
              <AccountMenu />
            </div>
          ) : (
            <IconButton label="Sign in" to="/login">
              <User className="h-[19px] w-[19px]" />
            </IconButton>
          )}
        </div>
      </nav>
      </motion.div>
    </header>
  );
}

export function AnnouncementBar() {
  const { data } = useSettings();
  const text = data?.announcement;
  if (!text) return <div className="h-9 bg-ink" aria-hidden />;
  const parts = text.split('·').map((s) => s.trim()).filter(Boolean);
  const row = [...parts, ...parts, ...parts];
  return (
    <div className="relative h-9 overflow-hidden bg-ink text-[12px] font-medium tracking-wide text-white/85" role="region" aria-label="Announcements">
      <p className="sr-only">{text}</p>
      <div className="flex w-max animate-marquee items-center motion-reduce:animate-none" aria-hidden>
        {[0, 1].map((k) => (
          <div key={k} className="flex h-9 items-center">
            {row.map((p, i) => (
              <span key={`${k}-${i}`} className="flex items-center whitespace-nowrap">
                <span className="px-8">{p}</span>
                <span className="text-brand-tint">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
