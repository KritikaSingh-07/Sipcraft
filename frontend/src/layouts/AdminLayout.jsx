import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, Users, Star, BadgePercent, CreditCard, BarChart3, Image, Settings, Menu, X, LogOut,
  ExternalLink, UsersRound, Inbox, RotateCcw, FileText, Bell, History, Search, UserCircle, ChevronDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi, userApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useAuthActions } from '@/hooks/useAuth';
import { useLockBody } from '@/hooks/useLockBody';
import { useDebounce } from '@/hooks/useDebounce';
import { useUnreadNotifications } from '@/hooks/queries';
import { Logo } from '@/components/layout/Brand';
import { FullPageLoader } from '@/components/ui/Feedback';
import { ScrollToTop, SkipLink } from './MainLayout';
import { initials, formatPrice, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

const NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 }] },
  {
    group: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package, badge: 'lowStock' },
      { to: '/admin/categories', label: 'Categories', icon: Layers },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, badge: 'reviews' },
      { to: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
    ],
  },
  {
    group: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: 'orders' },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/refunds', label: 'Refunds', icon: RotateCcw },
      { to: '/admin/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/admin/banners', label: 'Banners', icon: Image },
      { to: '/admin/content', label: 'Content', icon: FileText },
      { to: '/admin/team', label: 'Team', icon: UsersRound },
      { to: '/admin/messages', label: 'Contact messages', icon: Inbox, badge: 'messages' },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/activity', label: 'Activity log', icon: History },
      { to: '/admin/profile', label: 'My profile', icon: UserCircle },
    ],
  },
];

function Sidebar({ onNavigate }) {
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, staleTime: 60_000 });
  const badges = { orders: data?.stats?.pendingOrders, messages: data?.stats?.newMessages, reviews: data?.stats?.pendingReviews, lowStock: data?.stats?.lowStockCount };
  return (
    <nav className="flex h-full flex-col" aria-label="Admin">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light />
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white/70">ADMIN</span>
      </div>
      <div className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.2em] text-white/35 uppercase">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, end, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) => cn('relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition', isActive ? 'text-ink' : 'text-white/65 hover:bg-white/5 hover:text-white')}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-white" transition={{ type: 'spring', damping: 32, stiffness: 400 }} />}
                        <Icon className="relative h-4 w-4" />
                        <span className="relative">{label}</span>
                        {badge && badges[badge] > 0 && (
                          <span className={cn('relative ml-auto rounded-full px-2 text-[11px] font-bold', isActive ? 'bg-ink text-white' : badge === 'lowStock' ? 'bg-warning text-white' : 'bg-brand text-white')}>{badges[badge]}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 hover:text-white">
          <ExternalLink className="h-4 w-4" /> View storefront
        </Link>
      </div>
    </nav>
  );
}

function useClickAway(open, setOpen) {
  const ref = useRef(null);
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
  }, [open, setOpen]);
  return ref;
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q.trim(), 250);
  const ref = useClickAway(open, setOpen);
  const navigate = useNavigate();
  const { data, isFetching } = useQuery({ queryKey: ['admin', 'search', debounced], queryFn: () => adminApi.search(debounced), enabled: debounced.length >= 2 });
  const go = (to) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };
  const empty = data && !data.products.length && !data.orders.length && !data.customers.length;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
      <label htmlFor="admin-global-search" className="sr-only">
        Search orders, products and customers
      </label>
      <input
        id="admin-global-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search orders, products, customers…"
        className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm outline-none focus:border-ink"
        autoComplete="off"
      />
      <AnimatePresence>
        {open && debounced.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-12 right-0 left-0 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-lift">
            {isFetching && !data && <p className="p-3 text-sm text-muted">Searching…</p>}
            {empty && <p className="p-3 text-sm text-muted">No results for “{debounced}”.</p>}
            {data?.orders?.length > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-subtle uppercase">Orders</p>}
            {data?.orders?.map((o) => (
              <button key={o._id} onClick={() => go(`/admin/orders/${o._id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-sand">
                <span className="font-bold">{o.orderNumber}</span>
                <span className="truncate text-muted">{o.contact?.name}</span>
                <span className="ml-auto font-semibold">{formatPrice(o.total)}</span>
              </button>
            ))}
            {data?.products?.length > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-subtle uppercase">Products</p>}
            {data?.products?.map((p) => (
              <button key={p._id} onClick={() => go(`/admin/products/${p._id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-sand">
                <img src={p.images?.[0]?.url} alt="" className="h-8 w-8 rounded-lg bg-sand object-cover" />
                <span className="truncate font-semibold">{p.name}</span>
                <span className="ml-auto text-xs text-muted">{p.sku}</span>
              </button>
            ))}
            {data?.customers?.length > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-subtle uppercase">Customers</p>}
            {data?.customers?.map((c) => (
              <button key={c._id} onClick={() => go(`/admin/customers/${c._id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-sand">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-sand text-[11px] font-bold">{initials(c.name)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.email}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, setOpen);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: unread } = useUnreadNotifications();
  const { data } = useQuery({ queryKey: ['notifications', 'admin-bell'], queryFn: () => userApi.notifications({ limit: 8 }), enabled: open });
  const markAll = useMutation({ mutationFn: userApi.markAllRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const markRead = useMutation({ mutationFn: userApi.markRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-sand" aria-label={`Notifications${unread?.unread ? `, ${unread.unread} unread` : ''}`} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread?.unread > 0 && <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{unread.unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift sm:w-96">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-bold">Notifications</p>
              {unread?.unread > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs font-semibold text-muted hover:text-ink">
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {(data?.items || []).map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => {
                      if (!n.isRead) markRead.mutate(n._id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-sand', !n.isRead && 'bg-brand-soft/40')}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand')} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{n.title}</span>
                      <span className="line-clamp-2 block text-xs text-muted">{n.message}</span>
                      <span className="mt-0.5 block text-[11px] text-subtle">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {data && !data.items.length && <li className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</li>}
            </ul>
            <Link to="/admin/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold hover:bg-sand">
              Open notification centre
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-sand" aria-haspopup="menu" aria-expanded={open}>
        {user?.avatar?.url ? <img src={user.avatar.url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{initials(user?.name)}</span>}
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-4 font-bold">{user?.name}</span>
          <span className="block text-[11px] text-muted">Administrator</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
            <Link role="menuitem" to="/admin/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
              <UserCircle className="h-4 w-4 text-muted" /> My profile
            </Link>
            <Link role="menuitem" to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
              <ExternalLink className="h-4 w-4 text-muted" /> View storefront
            </Link>
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              onClick={async () => {
                await logout();
                toast.success('Signed out');
                navigate('/login');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useLockBody(open);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      <ScrollToTop />
      <title>Admin · Sipcraft</title>
      <meta name="robots" content="noindex,nofollow" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 bg-ink" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }} role="dialog" aria-modal="true" aria-label="Admin menu">
              <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <button onClick={() => setOpen(true)} className="-ml-2 rounded-full p-2 hover:bg-sand lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 md:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <div className="border-b border-line px-4 py-2 md:hidden">
          <GlobalSearch />
        </div>
        <main id="main" tabIndex={-1} className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

