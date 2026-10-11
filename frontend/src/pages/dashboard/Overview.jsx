import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, Clock, PackageCheck, Heart, ArrowRight, ShoppingBag, Wallet, MapPin, User, Bell, Sparkles, Truck } from 'lucide-react';
import { userApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/Motion';
import { OrderStatusBadge } from '@/components/order/OrderParts';
import { ProductGrid } from '@/components/product/ProductCard';
import { Panel, StatTile } from '@/components/dashboard/DashUI';
import { Avatar, profileCompletion } from '@/layouts/DashboardLayout';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatPrice, formatDate, formatCompactPrice } from '@/utils/format';
import { ORDER_FLOW } from '@/utils/constants';

const EASE = [0.16, 1, 0.3, 1];

/** Kept for any page that still imports it. */
export function DashboardCard(props) {
  return <StatTile {...props} />;
}

/** Thin progress bar showing how far an order is through fulfilment. */
function OrderProgress({ status }) {
  const i = ORDER_FLOW.indexOf(status);
  if (i < 0) return null;
  const pct = ((i + 1) / ORDER_FLOW.length) * 100;
  return (
    <div className="mt-2 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-line">
      <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-tint" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: EASE }} />
    </div>
  );
}

function WelcomeBanner({ user, stats }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const completion = profileCompletion(user);
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white sm:p-9"
    >
      <div aria-hidden className="aurora-blob -top-24 -right-16 h-72 w-72 animate-aurora bg-brand" />
      <div aria-hidden className="aurora-blob -bottom-28 left-1/3 h-64 w-64 animate-aurora-alt bg-[#e2557a]/60" />
      <div aria-hidden className="grain absolute inset-0" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-5">
          <Avatar user={user} className="h-16 w-16 text-lg ring-4 ring-white/10 sm:h-20 sm:w-20 sm:text-xl" rounded="rounded-[1.5rem]" />
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-white/55 uppercase">{greeting}</p>
            <h1 className="display mt-2 text-4xl sm:text-5xl">
              Hey, <span className="serif-accent text-brand-tint">{user?.name?.split(' ')[0]}.</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {stats?.pendingOrders
                ? `${stats.pendingOrders} order${stats.pendingOrders === 1 ? ' is' : 's are'} on the way to you.`
                : stats?.totalOrders
                  ? 'Everything’s delivered — time for a refill?'
                  : 'Welcome to Sipcraft — your first bottle is a click away.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {completion < 100 && (
            <Link to="/dashboard/profile" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur transition hover:bg-white/10">
              <span className="relative grid h-10 w-10 place-items-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#b9a8e8" strokeWidth="3" strokeLinecap="round" strokeDasharray="94.25" initial={{ strokeDashoffset: 94.25 }} animate={{ strokeDashoffset: 94.25 * (1 - completion / 100) }} transition={{ duration: 1.2, delay: 0.4, ease: EASE }} />
                </svg>
                <span className="text-[10px] font-bold">{completion}%</span>
              </span>
              <span className="text-sm">
                <span className="block font-bold">Complete your profile</span>
                <span className="text-white/55">Add a photo & phone</span>
              </span>
            </Link>
          )}
          <Button to="/products" variant="light" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Continue shopping
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

const QUICK = [
  { to: '/orders?status=active', icon: Truck, label: 'Track an order' },
  { to: '/dashboard/addresses', icon: MapPin, label: 'Manage addresses' },
  { to: '/dashboard/profile', icon: User, label: 'Edit profile' },
  { to: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
];

export default function Overview() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: userApi.dashboard });

  return (
    <PageTransition>
      <Seo title="My account" noindex />
      <WelcomeBanner user={user} stats={data?.stats} />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <Stagger className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-5">
            {isLoading
              ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-[1.5rem]" />)
              : [
                  { icon: Package, label: 'Total orders', value: data.stats.totalOrders, to: '/orders', tone: 'ink' },
                  { icon: Clock, label: 'In progress', value: data.stats.pendingOrders, tone: 'warning', to: '/orders?status=active' },
                  { icon: PackageCheck, label: 'Delivered', value: data.stats.deliveredOrders, tone: 'success', to: '/orders?status=DELIVERED' },
                  { icon: Heart, label: 'Wishlist', value: data.stats.wishlistCount, tone: 'rose', to: '/dashboard/wishlist' },
                  { icon: Wallet, label: 'Total spent', value: formatCompactPrice(data.stats.totalSpent || 0), tone: 'brand' },
                ].map((c, i) => (
                  <StaggerItem key={c.label} className={i === 4 ? 'col-span-2 xl:col-span-1' : undefined}>
                    <StatTile {...c} />
                  </StaggerItem>
                ))}
          </Stagger>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
            <Panel
              title="Recent orders"
              icon={Package}
              description="Your latest purchases and where they are."
              delay={0.1}
              bodyClassName="p-3 sm:p-4"
              action={
                <Link to="/orders" className="group inline-flex items-center gap-1 text-sm font-semibold">
                  View all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              }
            >
              {isLoading ? (
                <div className="space-y-3 p-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-2xl" />
                  ))}
                </div>
              ) : data.recentOrders.length ? (
                <ul>
                  {data.recentOrders.map((o, idx) => (
                    <motion.li key={o._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.06, ease: EASE }}>
                      <Link to={`/orders/${o._id}`} className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-sand">
                        <div className="flex -space-x-3">
                          {o.items.slice(0, 3).map((i) => (
                            <img key={i._id} src={i.image} alt="" className="h-12 w-10 rounded-xl border-2 border-surface bg-sand object-cover transition duration-300 group-hover:-translate-y-0.5" />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{o.orderNumber}</p>
                          <p className="text-xs text-muted">
                            {formatDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}
                          </p>
                          <OrderProgress status={o.orderStatus} />
                        </div>
                        <OrderStatusBadge status={o.orderStatus} className="hidden sm:inline-flex" />
                        <span className="text-sm font-bold">{formatPrice(o.total)}</span>
                        <ArrowRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={ShoppingBag} title="No orders yet" description="When you place an order, it’ll show up here." action={<Button to="/products" size="sm">Shop now</Button>} />
              )}
            </Panel>

            <Panel title="Quick actions" icon={Sparkles} delay={0.18} bodyClassName="grid grid-cols-2 gap-3 p-4 xl:grid-cols-1">
              {QUICK.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl border border-line p-3 text-sm font-semibold transition hover:border-ink hover:bg-ink hover:text-white">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-ink transition group-hover:bg-white/10 group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                  <ArrowRight className="ml-auto hidden h-4 w-4 opacity-0 transition group-hover:opacity-100 sm:block" />
                </Link>
              ))}
            </Panel>
          </div>

          <section className="mt-12">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Picked for you</p>
                <h2 className="display mt-2 text-3xl">
                  Recommended <span className="serif-accent text-brand">next sips.</span>
                </h2>
              </div>
              <Button to="/products" variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Shop all
              </Button>
            </div>
            <ProductGrid products={data?.recommended || []} loading={isLoading} skeletonCount={4} columns="grid-cols-2 xl:grid-cols-4" />
          </section>
        </>
      )}
    </PageTransition>
  );
}
