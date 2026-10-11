import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { IndianRupee, ShoppingCart, Receipt, Repeat, MousePointerClick, ShoppingBag } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { AdminPage, StatCard, ChartCard } from '@/components/admin/AdminUI';
import { RevenueArea, OrdersBars, RankedBars, GrowthLine } from '@/components/admin/Charts';
import { ErrorState, EmptyState } from '@/components/ui/Feedback';
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/utils/constants';
import { formatPrice, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

const RANGES = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['12m', '12 months'],
];

export default function AdminAnalytics() {
  const [range, setRange] = useState('30d');
  const [tableView, setTableView] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ['admin', 'analytics', range], queryFn: () => adminApi.analytics(range), placeholderData: keepPreviousData });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const s = data?.summary || {};
  const cv = data?.conversion || {};
  const label = RANGES.find((r) => r[0] === range)[1];

  return (
    <AdminPage
      title="Analytics"
      description="Revenue, orders and customer insights from MongoDB aggregations."
      actions={
        <div className="flex rounded-full border border-line-strong bg-surface p-1" role="tablist" aria-label="Date range">
          {RANGES.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={range === v} onClick={() => setRange(v)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', range === v ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard loading={isLoading} label="Today" value={formatPrice(s.dailyRevenue)} icon={IndianRupee} />
          <StatCard loading={isLoading} label="Last 7 days" value={formatPrice(s.weeklyRevenue)} icon={IndianRupee} tone="bg-info-soft text-info" />
          <StatCard loading={isLoading} label="This month" value={formatPrice(s.monthlyRevenue)} icon={IndianRupee} tone="bg-success-soft text-success" />
          <StatCard loading={isLoading} label="This year" value={formatPrice(s.yearlyRevenue)} icon={IndianRupee} tone="bg-sand text-ink" />
          <StatCard loading={isLoading} label={`Revenue · ${label}`} value={formatPrice(s.periodRevenue)} change={s.revenueChange} hint="vs previous period" icon={Receipt} />
          <StatCard loading={isLoading} label={`Orders · ${label}`} value={formatNumber(s.periodOrders)} change={s.ordersChange} hint="vs previous period" icon={ShoppingCart} tone="bg-info-soft text-info" />
          <StatCard loading={isLoading} label="Average order value" value={formatPrice(s.averageOrderValue)} icon={ShoppingBag} tone="bg-warning-soft text-warning" hint={label} />
          <StatCard loading={isLoading} label="Checkout conversion" value={`${cv.checkoutConversionRate ?? 0}%`} icon={MousePointerClick} tone="bg-success-soft text-success" hint={`${cv.checkoutsPaid ?? 0} of ${cv.checkoutsStarted ?? 0} checkouts`} />
        </div>

        <ChartCard
          className="mt-6"
          title="Revenue over time"
          subtitle={`${label} · ${data?.granularity === 'month' ? 'monthly' : data?.granularity === 'week' ? 'weekly' : 'daily'} · paid orders`}
          loading={isLoading}
          height={300}
          action={
            <button onClick={() => setTableView((t) => !t)} className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold hover:border-ink">
              {tableView ? 'Show chart' : 'Show table'}
            </button>
          }
        >
          {tableView ? (
            <div className="max-h-[300px] overflow-auto rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Period</th>
                    <th className="px-4 py-2 text-right font-semibold">Orders</th>
                    <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.series || []).map((r) => (
                    <tr key={r.period} className="border-t border-line">
                      <td className="px-4 py-2">{r.period}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.orders}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPrice(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <RevenueArea data={data?.series || []} height={300} />
          )}
        </ChartCard>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Orders over time" subtitle={label} loading={isLoading}>
            <OrdersBars data={data?.series || []} />
          </ChartCard>
          <ChartCard title="Customer growth" subtitle="Total customers · last 12 months" loading={isLoading}>
            <GrowthLine data={data?.customerGrowth || []} />
          </ChartCard>
          <ChartCard title="Best-selling products" subtitle={`${label} · units sold`} loading={isLoading}>
            {data?.topProducts?.length ? <RankedBars data={data.topProducts} valueKey="quantity" money={false} /> : <EmptyState compact icon={ShoppingBag} title="No sales in this period" />}
          </ChartCard>
          <ChartCard title="Top categories" subtitle={`${label} · revenue`} loading={isLoading}>
            {data?.categorySales?.length ? <RankedBars data={data.categorySales} /> : <EmptyState compact icon={ShoppingBag} title="No sales in this period" />}
          </ChartCard>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-bold">Customer behaviour</h2>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              {[
                ['Paying customers', formatNumber(cv.payingCustomers)],
                ['Repeat customer rate', `${cv.repeatCustomerRate ?? 0}%`],
                ['Active carts', formatNumber(cv.activeCarts)],
                ['All-time revenue', formatPrice(s.allTimeRevenue)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-sand p-4">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted">
              <Repeat className="h-3.5 w-3.5" /> Repeat rate = customers with 2+ paid orders ÷ all paying customers.
            </p>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Order status mix</h2>
            <p className="text-xs text-muted">{label}</p>
            <ul className="mt-5 space-y-3">
              {(data?.orderStatusMix || [])
                .sort((a, b) => b.count - a.count)
                .map((r) => {
                  const total = data.orderStatusMix.reduce((n, x) => n + x.count, 0);
                  return (
                    <li key={r.status}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{ORDER_STATUS_META[r.status]?.label || r.status}</span>
                        <span className="text-muted tabular-nums">
                          {r.count} · {Math.round((r.count / total) * 100)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(r.count / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              {!data?.orderStatusMix?.length && <li className="text-sm text-muted">No orders in this period.</li>}
            </ul>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="card p-6">
            <h2 className="font-bold">Customers · {label}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {[
                ['New sign-ups', formatNumber(data?.customers?.newCustomers)],
                ['Buyers', formatNumber(data?.customers?.buyers)],
                ['First-time buyers', formatNumber(data?.customers?.firstTimeBuyers)],
                ['Returning buyers', formatNumber(data?.customers?.returningCustomers)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-sand p-4">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">{formatNumber(data?.cancelledOrders)} paid orders cancelled in this period.</p>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Stock health</h2>
            <p className="text-xs text-muted">Live, excluding archived products</p>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                ['In stock', data?.inventory?.inStock, 'bg-success'],
                ['Low stock', data?.inventory?.lowStock, 'bg-warning'],
                ['Out of stock', data?.inventory?.outOfStock, 'bg-danger'],
              ].map(([k, v, dot]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden /> {k}
                  </span>
                  <b className="tabular-nums">{formatNumber(v)} products</b>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-muted">Units on hand</span>
                <b className="tabular-nums">{formatNumber(data?.inventory?.units)}</b>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted">Stock value (retail)</span>
                <b className="tabular-nums">{formatPrice(data?.inventory?.stockValue)}</b>
              </li>
            </ul>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Payments · {label}</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {(data?.payments || [])
                .filter((p) => p.status !== 'CREATED')
                .map((p) => (
                  <li key={p.status} className="flex items-center justify-between">
                    <span>{PAYMENT_STATUS_META[p.status]?.label || p.status}</span>
                    <span className="text-right">
                      <b className="tabular-nums">{formatPrice(p.amount)}</b>
                      <span className="ml-2 text-xs text-muted">{p.count} txns</span>
                    </span>
                  </li>
                ))}
            </ul>
            {(() => {
              const paid = data?.payments?.find((p) => p.status === 'PAID')?.count || 0;
              const failed = data?.payments?.find((p) => p.status === 'FAILED')?.count || 0;
              return paid + failed > 0 ? <p className="mt-4 rounded-2xl bg-sand p-3 text-xs text-muted">Payment success rate: <b className="text-ink">{Math.round((paid / (paid + failed)) * 100)}%</b></p> : null;
            })()}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
