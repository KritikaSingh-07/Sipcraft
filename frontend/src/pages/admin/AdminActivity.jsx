import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { History, Package, ShoppingCart, RotateCcw, BadgePercent, User, Star, FileText, Settings, Image, Layers, Bell, Inbox, UsersRound } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useDebounce } from '@/hooks/useDebounce';
import { AdminPage, Toolbar, FilterSelect } from '@/components/admin/AdminUI';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatDateTime, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

const ICONS = { product: Package, order: ShoppingCart, coupon: BadgePercent, user: User, review: Star, content: FileText, settings: Settings, banner: Image, category: Layers, notification: Bell, message: Inbox, team: UsersRound };
const TONES = { refund: 'bg-success-soft text-success', deleted: 'bg-danger-soft text-danger', disabled: 'bg-danger-soft text-danger' };

export default function AdminActivity() {
  const [entity, setEntity] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'activity', entity, page, debounced], queryFn: () => adminApi.activity({ entity, page, search: debounced }), placeholderData: keepPreviousData });

  return (
    <AdminPage title="Activity log" description="An audit trail of important admin actions — who did what, and when.">
      <Toolbar search={search} onSearch={(v) => (setSearch(v), setPage(1))} placeholder="Search actions">
        <FilterSelect label="Area" value={entity} onChange={(v) => (setEntity(v), setPage(1))} options={[{ value: 'all', label: 'All areas' }, ...(data?.entities || []).map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))]} />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !data.items.length ? (
        <EmptyState icon={History} title="No activity yet" description="Admin actions such as product edits, refunds and settings changes are recorded here." />
      ) : (
        <ol className="card divide-y divide-line">
          {data.items.map((a) => {
            const Icon = a.action.startsWith('refund') ? RotateCcw : ICONS[a.entity] || History;
            const tone = Object.entries(TONES).find(([k]) => a.action.includes(k))?.[1] || 'bg-sand text-ink';
            return (
              <li key={a._id} className="flex gap-4 p-4 sm:p-5">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.description || a.action}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-mono">{a.action}</span> · {a.admin?.name || 'Admin'} · <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</time>
                    {a.ipAddress ? ` · ${a.ipAddress}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Pagination className="mt-6" page={page} pages={data?.pagination?.pages} onChange={setPage} />
    </AdminPage>
  );
}
