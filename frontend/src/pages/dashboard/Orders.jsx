import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, ArrowRight, ClipboardCheck, Check, Truck, Home, Box } from 'lucide-react';
import { orderApi } from '@/api/endpoints';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageTransition, Stagger, StaggerItem } from '@/components/ui/Motion';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/OrderParts';
import { DashHeader, PillTabs } from '@/components/dashboard/DashUI';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatPrice, formatDate } from '@/utils/format';
import { ORDER_FLOW } from '@/utils/constants';
import { cn } from '@/utils/cn';

const TABS = [
  ['', 'All'],
  ['active', 'In progress'],
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
];
const STEP_ICONS = [ClipboardCheck, Check, Box, Truck, Truck, Home];
const EASE = [0.16, 1, 0.3, 1];

export function OrderListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 rounded-[1.75rem] border border-line bg-surface p-6">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-20 w-16 rounded-xl" />
            <Skeleton className="h-20 w-16 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact six-step delivery track. */
function MiniTrack({ status }) {
  const current = ORDER_FLOW.indexOf(status);
  if (current < 0) return null;
  return (
    <div className="flex items-center" aria-label={`Step ${current + 1} of ${ORDER_FLOW.length}`}>
      {ORDER_FLOW.map((s, i) => {
        const Icon = STEP_ICONS[i];
        const done = i <= current;
        return (
          <div key={s} className={cn('flex items-center', i > 0 && 'flex-1')}>
            {i > 0 && (
              <div className="mx-1 h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-tint" initial={{ width: 0 }} animate={{ width: done ? '100%' : 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: EASE }} />
              </div>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full transition', done ? 'bg-ink text-white' : 'bg-sand text-subtle', i === current && status !== 'DELIVERED' && 'ring-4 ring-brand-soft')}
            >
              <Icon className="h-3.5 w-3.5" />
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', status, page],
    queryFn: () => orderApi.list({ status, page, limit: 8 }),
    placeholderData: keepPreviousData,
  });

  return (
    <PageTransition>
      <Seo title="My orders" noindex />
      <DashHeader
        icon={Package}
        eyebrow="Orders"
        title="Your"
        accent="orders."
        description="Track deliveries and review what you’ve bought."
        action={data?.pagination?.total > 0 && <p className="text-sm text-muted">{data.pagination.total} order{data.pagination.total === 1 ? '' : 's'}</p>}
      />
      <PillTabs className="mt-6" id="orders-tabs" tabs={TABS} value={status} onChange={(v) => setParams(v ? { status: v } : {})} />

      <div className="mt-8">
        {isLoading ? (
          <OrderListSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.items.length ? (
          <EmptyState icon={Package} title={status ? 'No orders here' : 'No orders yet'} description="Your orders will appear here once you’ve checked out." action={<Button to="/products">Start shopping</Button>} />
        ) : (
          <Stagger key={`${status}-${page}`} className="space-y-4">
            {data.items.map((o) => (
              <StaggerItem key={o._id}>
                <Link to={`/orders/${o._id}`} className="group relative block overflow-hidden rounded-[1.75rem] border border-line bg-surface p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-lift sm:p-6">
                  <div aria-hidden className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-gradient-to-b from-brand to-[#e2557a] transition-transform duration-500 group-hover:scale-y-100" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sand transition group-hover:bg-ink group-hover:text-white">
                        <Package className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-bold">Order {o.orderNumber}</p>
                        <p className="text-sm text-muted">
                          Placed {formatDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {o.orderStatus === 'PENDING_PAYMENT' && <PaymentStatusBadge status={o.paymentStatus} />}
                      <OrderStatusBadge status={o.orderStatus} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div className="flex -space-x-4">
                      {o.items.slice(0, 4).map((i, idx) => (
                        <img
                          key={i._id}
                          src={i.image}
                          alt={i.name}
                          style={{ zIndex: 10 - idx }}
                          className="relative h-20 w-16 rounded-xl border-[3px] border-surface bg-sand object-cover shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-3deg]"
                          loading="lazy"
                        />
                      ))}
                      {o.items.length > 4 && <span className="relative grid h-20 w-16 place-items-center rounded-xl border-[3px] border-surface bg-ink text-sm font-bold text-white">+{o.items.length - 4}</span>}
                    </div>
                    <div className="sm:px-4">
                      <MiniTrack status={o.orderStatus} />
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                      <p className="text-xl font-extrabold tracking-tight">{formatPrice(o.total)}</p>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted group-hover:text-ink">
                        Details <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <Pagination className="mt-8" page={page} pages={data?.pagination?.pages} onChange={(p) => setParams({ ...(status && { status }), page: String(p) })} />
      </div>
    </PageTransition>
  );
}
