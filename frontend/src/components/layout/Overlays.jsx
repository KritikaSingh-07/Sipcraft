import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Clock, ArrowUpRight, Heart, User, ShoppingBag, Truck, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { Drawer } from '@/components/ui/Modal';
import { NAV_LINKS } from './Navbar';
import { Logo, SocialIcon, SOCIAL_LINKS } from './Brand';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSearchHistory } from '@/store/guestStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useLockBody } from '@/hooks/useLockBody';
import { useCart, useCartActions } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { productApi } from '@/api/endpoints';
import { useProducts } from '@/hooks/queries';
import { formatPrice } from '@/utils/format';
import Button from '@/components/ui/Button';
import { QuantitySelector } from '@/components/ui/Commerce';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { cn } from '@/utils/cn';

/* ─── Mobile menu ──────────────────────────────────────── */
export function MobileMenu() {
  const open = useUIStore((s) => s.mobileMenuOpen);
  const setOpen = useUIStore((s) => s.setMobileMenu);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const { count: wish } = useWishlist();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname, setOpen]);

  return (
    <Drawer open={open} onClose={() => setOpen(false)} side="left" title={<Logo />} label="Menu">
      <nav className="flex h-full flex-col px-5 py-6" aria-label="Mobile">
        <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }} className="space-y-1">
          {NAV_LINKS.map((l) => (
            <motion.li key={l.to} variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) => cn('flex items-center justify-between rounded-2xl px-4 py-3.5 text-2xl font-bold tracking-tight', isActive ? 'bg-sand text-ink' : 'text-ink-soft')}
              >
                {l.label}
                <ArrowUpRight className="h-5 w-5 text-subtle" />
              </NavLink>
            </motion.li>
          ))}
        </motion.ul>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link to="/wishlist" className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-semibold">
            <Heart className="h-4 w-4" /> Wishlist {wish > 0 && <span className="ml-auto rounded-full bg-brand px-2 text-[11px] text-white">{wish}</span>}
          </Link>
          <Link to={status === 'authenticated' ? '/dashboard' : '/login'} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-semibold">
            <User className="h-4 w-4" /> {status === 'authenticated' ? 'Account' : 'Sign in'}
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="col-span-2 rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-bold text-brand-dark">
              Open admin dashboard
            </Link>
          )}
        </div>
        <div className="mt-auto pt-8">
          <div className="rounded-3xl bg-ink p-5 text-white">
            <Truck className="mb-3 h-5 w-5 text-brand-tint" />
            <p className="font-bold">Free shipping above ₹999</p>
            <p className="mt-1 text-sm text-white/60">Dispatched within 24 hours from Bengaluru.</p>
          </div>
          <div className="mt-5 flex gap-2">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft">
                <SocialIcon name={s.name} />
              </a>
            ))}
          </div>
        </div>
      </nav>
    </Drawer>
  );
}

/* ─── Search overlay with autocomplete ─────────────────── */
export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen);
  const close = useUIStore((s) => s.closeSearch);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(q.trim(), 250);
  const { terms, add, remove, clear } = useSearchHistory();
  const inputRef = useRef(null);
  useLockBody(open);

  const { data, isFetching } = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: () => productApi.suggestions(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  });
  const { data: trending } = useProducts({ bestSeller: true, limit: 4, sort: 'popularity' }, { enabled: open });

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(-1);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const results = data?.products || [];
  const go = (term) => {
    const t = term.trim();
    if (!t) return;
    add(t);
    close();
    navigate(`/products?search=${encodeURIComponent(t)}`);
  };
  const openProduct = (p) => {
    if (q.trim()) add(q.trim());
    close();
    navigate(`/products/${p.slug}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && results[active]) openProduct(results[active]);
      else go(q);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            className="relative mx-auto mt-0 max-h-[100dvh] w-full max-w-3xl overflow-y-auto bg-surface shadow-lift sm:mt-[8vh] sm:max-h-[80vh] sm:rounded-3xl"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
              <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search tumblers, sippers, bottles…"
                className="h-10 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-subtle"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="search-results"
                aria-activedescendant={active >= 0 ? `sr-${active}` : undefined}
                aria-autocomplete="list"
                aria-label="Search products"
              />
              {isFetching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-hidden />}
              <button onClick={close} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label="Close search">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {debounced.length >= 2 ? (
                results.length || data?.categories?.length ? (
                  <>
                    {data.categories?.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {data.categories.map((c) => (
                          <Link
                            key={c._id}
                            to={`/products?category=${c.slug}`}
                            onClick={close}
                            className="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold hover:border-ink"
                          >
                            in {c.name}
                          </Link>
                        ))}
                      </div>
                    )}
                    <ul id="search-results" role="listbox" className="space-y-1">
                      {results.map((p, i) => (
                        <li key={p._id} id={`sr-${i}`} role="option" aria-selected={i === active}>
                          <button
                            onClick={() => openProduct(p)}
                            onMouseEnter={() => setActive(i)}
                            className={cn('flex w-full items-center gap-4 rounded-2xl p-2.5 text-left transition', i === active ? 'bg-sand' : 'hover:bg-sand')}
                          >
                            <img src={p.image} alt="" className="h-14 w-14 rounded-xl bg-sand object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{p.name}</span>
                              <span className="text-sm text-muted">{formatPrice(p.price)}</span>
                            </span>
                            <ArrowUpRight className="h-4 w-4 text-subtle" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => go(q)} className="mt-4 w-full rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white">
                      See all results for “{q.trim()}”
                    </button>
                  </>
                ) : (
                  !isFetching && (
                    <EmptyState compact icon={Search} title="No matches found" description={`We couldn’t find anything for “${debounced}”. Try “tumbler”, “sipper” or a colour.`} />
                  )
                )
              ) : (
                <div className="grid gap-8 sm:grid-cols-[1fr_1.4fr]">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="eyebrow">Recent searches</p>
                      {terms.length > 0 && (
                        <button onClick={clear} className="text-xs font-semibold text-muted hover:text-ink">
                          Clear
                        </button>
                      )}
                    </div>
                    {terms.length ? (
                      <ul className="space-y-1">
                        {terms.map((t) => (
                          <li key={t} className="group flex items-center rounded-xl hover:bg-sand">
                            <button onClick={() => go(t)} className="flex flex-1 items-center gap-3 px-3 py-2 text-left text-sm font-medium">
                              <Clock className="h-4 w-4 text-subtle" /> {t}
                            </button>
                            <button onClick={() => remove(t)} className="px-3 text-subtle opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${t}`}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {['Tumbler', 'Sipper', 'Coffee', 'Gift set', 'Kids'].map((t) => (
                          <button key={t} onClick={() => go(t)} className="rounded-full bg-sand px-3.5 py-1.5 text-sm font-semibold hover:bg-line">
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="eyebrow mb-3 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" /> Trending now
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(trending?.items || []).map((p) => (
                        <button key={p._id} onClick={() => openProduct(p)} className="group text-left">
                          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
                            <img src={p.images?.[0]?.url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-muted">{formatPrice(p.price)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ─── Cart drawer ──────────────────────────────────────── */
export function CartDrawer() {
  const open = useUIStore((s) => s.cartDrawerOpen);
  const close = useUIStore((s) => s.closeCartDrawer);
  const { cart, isLoading } = useCart();
  const { update, remove } = useCartActions();
  const { pathname } = useLocation();
  useEffect(() => close(), [pathname, close]);
  const totals = cart.totals;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          Your cart {cart.items.length > 0 && <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold">{cart.items.reduce((n, i) => n + i.quantity, 0)}</span>}
        </span>
      }
      footer={
        cart.items.length > 0 && totals ? (
          <div className="space-y-4">
            {totals.amountToFreeShipping > 0 ? (
              <div>
                <p className="mb-2 text-[13px] text-muted">
                  Add <b className="text-ink">{formatPrice(totals.amountToFreeShipping)}</b> more for free shipping
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-sand">
                  <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((totals.subtotal - totals.discount) / totals.freeShippingThreshold) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-[13px] font-semibold text-success">
                <Truck className="h-4 w-4" /> You’ve unlocked free shipping
              </p>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="text-xl font-bold">{formatPrice(totals.subtotal - totals.discount)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button to="/cart" variant="secondary" onClick={close}>
                View cart
              </Button>
              <Button to="/checkout" onClick={close}>
                Checkout
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-24 w-20 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : cart.items.length === 0 ? (
        <EmptyState
          compact
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Find a tumbler you’ll want to carry everywhere."
          action={
            <Button to="/products" onClick={close}>
              Start shopping
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line px-5">
          <AnimatePresence initial={false}>
            {cart.items.map((item) => (
              <motion.li key={item._id} layout exit={{ opacity: 0, x: 40 }} className="flex gap-4 py-5">
                <Link to={`/products/${item.product?.slug}`} onClick={close} className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-sand">
                  <img src={item.product?.image} alt={item.product?.name} className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <Link to={`/products/${item.product?.slug}`} onClick={close} className="truncate text-sm font-semibold">
                      {item.product?.name}
                    </Link>
                    <span className="text-sm font-bold">{formatPrice(item.lineTotal)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{[item.color, item.size].filter(Boolean).join(' · ')}</p>
                  {item.issue && <p className="mt-1 text-xs font-semibold text-danger">{item.issue}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <QuantitySelector size="sm" value={item.quantity} max={Math.min(20, item.product?.stock || 1)} onChange={(quantity) => update.mutate({ itemId: item._id, quantity })} />
                    <button onClick={() => remove.mutate(item._id)} className="text-xs font-semibold text-muted underline-offset-4 hover:text-danger hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Drawer>
  );
}
