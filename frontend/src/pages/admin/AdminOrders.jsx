import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { AdminPage, Toolbar, FilterSelect } from '@/components/admin/AdminUI';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/OrderParts';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/utils/constants';
import { formatPrice, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search, 350);
  const q = {
    search: debounced,
    status: params.get('status') || 'all',
    paymentStatus: params.get('paymentStatus') || 'all',
    from: params.get('from') || '',
    to: params.get('to') || '',
    page: Number(params.get('page')) || 1,
    limit: 20,
  };
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'orders', q], queryFn: () => adminApi.orders(q), placeholderData: keepPreviousData });
  const counts = data?.statusCounts || {};

  const tabs = ['all', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED'];

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <div>
          <p className="flex items-center gap-1.5 font-bold">
            {o.orderNumber}
            {o.stockConflict && <AlertTriangle className="h-4 w-4 text-warning" aria-label="Stock conflict" />}
          </p>
          <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{o.contact?.name || o.user?.name}</p>
          <p className="truncate text-xs text-muted">{o.contact?.email || o.user?.email}</p>
        </div>
      ),
    },
    { key: 'items', header: 'Items', render: (o) => o.items.reduce((n, i) => n + i.quantity, 0), hideOnMobile: true },
    { key: 'total', header: 'Total', render: (o) => <span className="font-bold tabular-nums">{formatPrice(o.total)}</span> },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentStatusBadge status={o.paymentStatus} /> },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusBadge status={o.orderStatus} /> },
  ];

  return (
    <AdminPage title="Orders" description="Search, filter and fulfil customer orders.">
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={q.status === t}
            onClick={() => set({ status: t })}
            className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition', q.status === t ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink')}
          >
            {t === 'all' ? 'All' : ORDER_STATUS_META[t].label}
            {t !== 'all' && counts[t] ? <span className="ml-1.5 opacity-60">{counts[t]}</span> : null}
          </button>
        ))}
      </div>
      <Toolbar search={search} onSearch={(v) => (setSearch(v), set({ search: v }))} placeholder="Order #, email, name, phone or tracking">
        <FilterSelect label="Payment status" value={q.paymentStatus} onChange={(v) => set({ paymentStatus: v })} options={[{ value: 'all', label: 'Any payment' }, ...Object.entries(PAYMENT_STATUS_META).map(([value, m]) => ({ value, label: m.label }))]} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">From</span>
          <input type="date" value={q.from} onChange={(e) => set({ from: e.target.value })} className="h-11 rounded-full border border-line-strong bg-surface px-4 text-sm text-ink outline-none focus:border-ink" aria-label="From date" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">To</span>
          <input type="date" value={q.to} onChange={(e) => set({ to: e.target.value })} className="h-11 rounded-full border border-line-strong bg-surface px-4 text-sm text-ink outline-none focus:border-ink" aria-label="To date" />
        </label>
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable columns={columns} rows={data?.items || []} loading={isLoading} onRowClick={(o) => navigate(`/admin/orders/${o._id}`)} empty={<EmptyState icon={ShoppingCart} title="No orders match" description="Try a different status, date or search term." />} />
      )}
      <Pagination className="mt-6" page={q.page} pages={data?.pagination?.pages} onChange={(p) => set({ page: String(p) })} />
    </AdminPage>
  );
}
