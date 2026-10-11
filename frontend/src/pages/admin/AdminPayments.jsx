import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { AdminPage, Toolbar, FilterSelect, StatCard } from '@/components/admin/AdminUI';
import { PaymentStatusBadge } from '@/components/order/OrderParts';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PAYMENT_STATUS_META } from '@/utils/constants';
import { formatPrice, formatDateTime } from '@/utils/format';

export default function AdminPayments() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 400);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'payments', status, page, debounced], queryFn: () => adminApi.payments({ status, page, search: debounced }), placeholderData: keepPreviousData });
  const summary = Object.fromEntries((data?.summary || []).map((s) => [s.status, s]));

  const columns = [
    {
      key: 'id',
      header: 'Payment',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold">{p.razorpayPaymentId || '—'}</p>
          <p className="truncate font-mono text-[11px] text-muted">{p.razorpayOrderId}</p>
        </div>
      ),
    },
    { key: 'order', header: 'Order', render: (p) => <span className="font-semibold">{p.order?.orderNumber || '—'}</span> },
    { key: 'customer', header: 'Customer', render: (p) => p.user?.name || '—', hideOnMobile: true },
    { key: 'amount', header: 'Amount', render: (p) => <b className="tabular-nums">{formatPrice(p.amount / 100)}</b> },
    { key: 'method', header: 'Method', render: (p) => <span className="uppercase">{p.method || '—'}</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
    { key: 'date', header: 'Date', render: (p) => <span className="text-xs">{formatDateTime(p.createdAt)}</span>, hideOnMobile: true },
  ];

  return (
    <AdminPage title="Payments" description="Every Razorpay transaction, verified by signature or webhook.">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {['PAID', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => (
          <StatCard key={s} loading={isLoading} label={PAYMENT_STATUS_META[s].label} value={formatPrice(summary[s]?.amount || 0)} hint={`${summary[s]?.count || 0} transactions`} />
        ))}
      </div>
      <Toolbar search={search} onSearch={(v) => (setSearch(v), setPage(1))} placeholder="Exact Razorpay order or payment ID">
        <FilterSelect label="Status" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={[{ value: 'all', label: 'Any status' }, ...Object.entries(PAYMENT_STATUS_META).map(([value, m]) => ({ value, label: m.label }))]} />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable columns={columns} rows={data?.items || []} loading={isLoading} onRowClick={(p) => p.order?._id && navigate(`/admin/orders/${p.order._id}`)} empty={<EmptyState icon={CreditCard} title="No payments found" />} />
      )}
      <Pagination className="mt-6" page={page} pages={data?.pagination?.pages} onChange={setPage} />
    </AdminPage>
  );
}
