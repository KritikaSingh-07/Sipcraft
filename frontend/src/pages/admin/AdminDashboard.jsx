import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, ShoppingCart, Clock, PackageCheck, Users, Package, AlertTriangle, CalendarDays, ArrowRight } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { AdminPage, StatCard, ChartCard } from '@/components/admin/AdminUI';
import { RevenueArea, OrdersBars, RankedBars, GrowthLine } from '@/components/admin/Charts';
import { OrderStatusBadge } from '@/components/order/OrderParts';
import { ErrorState, Skeleton, EmptyState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatPrice, formatNumber, timeAgo } from '@/utils/format';

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, refetchInterval: 60_000 });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const s = data?.stats || {};
  const c = data?.charts || {};

  return (
    <AdminPage
      title="Dashboard"
      description="Live store performance — every number is aggregated from the database."
      actions={
        <Button to="/admin/analytics" variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Full analytics
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard loading={isLoading} label="Total revenue" value={formatPrice(s.totalRevenue)} icon={IndianRupee} hint={`AOV ${formatPrice(s.averageOrderValue)}`} />
        <StatCard loading={isLoading} label="Today’s revenue" value={formatPrice(s.todayRevenue)} icon={CalendarDays} tone="bg-info-soft text-info" hint={`${s.todayOrders || 0} orders today`} />
        <StatCard loading={isLoading} label="This month" value={formatPrice(s.monthlyRevenue)} icon={IndianRupee} tone="bg-success-soft text-success" hint={`${s.monthlyOrders || 0} orders`} />
        <StatCard loading={isLoading} label="Total orders" value={formatNumber(s.totalOrders)} icon={ShoppingCart} tone="bg-sand text-ink" hint={`${s.cancelledOrders || 0} cancelled`} />
        <StatCard loading={isLoading} label="Pending fulfilment" value={formatNumber(s.pendingOrders)} icon={Clock} tone="bg-warning-soft text-warning" hint={`${s.inTransitOrders || 0} in transit`} />
        <StatCard loading={isLoading} label="Completed" value={formatNumber(s.completedOrders)} icon={PackageCheck} tone="bg-success-soft text-success" hint="delivered" />
        <StatCard loading={isLoading} label="Customers" value={formatNumber(s.customers)} icon={Users} tone="bg-brand-soft text-brand" />
        <StatCard loading={isLoading} label="Products" value={formatNumber(s.products)} icon={Package} tone="bg-sand text-ink" hint={`${s.lowStockCount || 0} low stock`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Revenue" subtitle="Last 30 days · paid orders" loading={isLoading}>
          <RevenueArea data={c.revenue || []} />
        </ChartCard>
        <ChartCard title="Orders" subtitle="Last 30 days" loading={isLoading}>
          <OrdersBars data={c.revenue || []} height={280} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard title="Top products" subtitle="All time · by revenue" loading={isLoading}>
          {c.topProducts?.length ? <RankedBars data={[...c.topProducts].sort((a, b) => b.revenue - a.revenue)} /> : <EmptyState compact icon={Package} title="No sales yet" />}
        </ChartCard>
        <ChartCard title="Category sales" subtitle="All time · by revenue" loading={isLoading}>
          {c.categorySales?.length ? <RankedBars data={c.categorySales} /> : <EmptyState compact icon={Package} title="No sales yet" />}
        </ChartCard>
        <ChartCard title="Customer growth" subtitle="Total customers · last 6 months" loading={isLoading}>
          <GrowthLine data={c.customerGrowth || []} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentOrders.map((o) => (
                <li key={o._id}>
                  <Link to={`/admin/orders/${o._id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-sand">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{o.orderNumber}</p>
                      <p className="truncate text-xs text-muted">
                        {o.contact?.name} · {timeAgo(o.createdAt)}
                      </p>
                    </div>
                    <OrderStatusBadge status={o.orderStatus} className="hidden sm:inline-flex" />
                    <span className="text-sm font-bold tabular-nums">{formatPrice(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-warning" /> Low stock
            </h2>
            <Link to="/admin/products?stock=low_stock" className="text-sm font-semibold underline-offset-4 hover:underline">
              Manage
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : data.lowStock.length ? (
            <ul className="space-y-2">
              {data.lowStock.map((p) => (
                <li key={p._id}>
                  <Link to={`/admin/products/${p._id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-sand">
                    <img src={p.images?.[0]?.url} alt="" className="h-10 w-10 rounded-lg bg-sand object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">{p.sku}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.stock <= 0 ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{p.stock <= 0 ? 'Out' : `${p.stock} left`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={PackageCheck} title="All stocked up" description="No products are below their threshold." />
          )}
        </section>
      </div>
    </AdminPage>
  );
}
