import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { MessageSquare, Check, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, Toolbar } from '@/components/admin/AdminUI';
import { RatingStars } from '@/components/ui/Commerce';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const TONES = { approved: 'success', pending: 'warning', hidden: 'neutral' };

export default function AdminReviews() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get('status') || 'all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'reviews', status, page, debounced], queryFn: () => adminApi.reviews({ status, page, search: debounced }), placeholderData: keepPreviousData });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    queryClient.invalidateQueries({ queryKey: ['reviews'] });
    queryClient.invalidateQueries({ queryKey: ['product'] });
  };
  const moderate = useMutation({ mutationFn: ({ id, s }) => adminApi.moderateReview(id, s), onSuccess: (r) => (toast.success(r.message), invalidate()), onError: (e) => toast.error(getErrorMessage(e)) });
  const remove = useMutation({ mutationFn: adminApi.deleteReview, onSuccess: () => (toast.success('Review deleted'), invalidate()), onError: (e) => toast.error(getErrorMessage(e)) });
  const counts = data?.counts || {};

  return (
    <AdminPage title="Reviews" description="Approve, hide or remove customer reviews. Ratings update automatically.">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {['all', 'pending', 'approved', 'hidden', 'reported'].map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => (setStatus(s), setPage(1))}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold capitalize transition', status === s ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink')}
          >
            {s}
            {s !== 'all' && counts[s] ? <span className="ml-1.5 opacity-60">{counts[s]}</span> : null}
          </button>
        ))}
      </div>
      <Toolbar search={search} onSearch={(v) => (setSearch(v), setPage(1))} placeholder="Search review text" />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : !data.items.length ? (
        <EmptyState icon={MessageSquare} title="No reviews here" description={status === 'pending' ? 'Nothing waiting for moderation.' : 'Reviews appear once customers rate delivered orders.'} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r._id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link to={`/products/${r.product?.slug}`} target="_blank" className="flex shrink-0 items-center gap-3 sm:w-56">
                  <img src={r.product?.images?.[0]?.url} alt="" className="h-14 w-12 rounded-xl bg-sand object-cover" />
                  <span className="line-clamp-2 text-sm font-semibold">{r.product?.name || 'Deleted product'}</span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars rating={r.rating} size={13} />
                    <Badge tone={TONES[r.status]}>{r.status}</Badge>
                    {r.reportCount > 0 && <Badge tone="danger">Reported ×{r.reportCount}</Badge>}
                    <span className="text-xs text-muted">
                      {r.user?.name} · {r.order?.orderNumber} · {formatDate(r.createdAt)}
                    </span>
                  </div>
                  {r.title && <p className="mt-2 font-bold">{r.title}</p>}
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{r.comment}</p>
                  {r.reports?.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-xl bg-danger-soft p-3 text-xs text-danger">
                      {r.reports.map((rep, i) => (
                        <li key={i}>Reported: {rep.reason}</li>
                      ))}
                    </ul>
                  )}
                  {r.images?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {r.images.map((img) => (
                        <img key={img.url} src={img.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  {r.status !== 'approved' && (
                    <Button size="xs" variant="soft" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => moderate.mutate({ id: r._id, s: 'approved' })}>
                      Approve
                    </Button>
                  )}
                  {r.status !== 'hidden' && (
                    <Button size="xs" variant="secondary" leftIcon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => moderate.mutate({ id: r._id, s: 'hidden' })}>
                      Hide
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="danger-soft"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this review?', description: 'The customer will be able to review this order item again.', confirmText: 'Delete', tone: 'danger' })) remove.mutate(r._id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={page} pages={data?.pagination?.pages} onChange={setPage} />
    </AdminPage>
  );
}
