import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { AdminPage, Toolbar, FilterSelect } from '@/components/admin/AdminUI';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { formatPrice, formatDate, initials } from '@/utils/format';

export default function AdminCustomers() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search, 350);
  const q = { search: debounced, status: params.get('status') || 'all', role: params.get('role') || 'user', page: Number(params.get('page')) || 1, limit: 20 };
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'customers', q], queryFn: () => adminApi.customers(q), placeholderData: keepPreviousData });

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (u) => (
        <div className="flex items-center gap-3">
          {u.avatar?.url ? <img src={u.avatar.url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold">{initials(u.name)}</span>}
          <div className="min-w-0">
            <p className="truncate font-semibold">{u.name}</p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u) => u.phone || '—', hideOnMobile: true },
    { key: 'orders', header: 'Orders', render: (u) => u.orders },
    { key: 'spent', header: 'Spent', render: (u) => <span className="font-semibold tabular-nums">{formatPrice(u.totalSpent)}</span> },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.createdAt), hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex gap-1">
          <Badge tone={u.isActive ? 'success' : 'danger'} dot>
            {u.isActive ? 'Active' : 'Disabled'}
          </Badge>
          {u.role === 'admin' && <Badge tone="brand">Admin</Badge>}
        </div>
      ),
    },
  ];

  return (
    <AdminPage title="Customers" description="View customer accounts, order history and lifetime value.">
      <Toolbar search={search} onSearch={(v) => (setSearch(v), set({ search: v }))} placeholder="Search name, email or phone">
        <FilterSelect label="Role" value={q.role} onChange={(v) => set({ role: v })} options={[{ value: 'user', label: 'Customers' }, { value: 'admin', label: 'Admins' }, { value: 'all', label: 'Everyone' }]} />
        <FilterSelect label="Status" value={q.status} onChange={(v) => set({ status: v })} options={[{ value: 'all', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Disabled' }]} />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable columns={columns} rows={data?.items || []} loading={isLoading} onRowClick={(u) => navigate(`/admin/customers/${u._id}`)} empty={<EmptyState icon={Users} title="No customers found" />} />
      )}
      <Pagination className="mt-6" page={q.page} pages={data?.pagination?.pages} onChange={(p) => set({ page: String(p) })} />
    </AdminPage>
  );
}
