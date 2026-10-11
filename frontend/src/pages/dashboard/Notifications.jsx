import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Package, CreditCard, User, Tag, Star, CheckCheck, X, ArrowRight, BellOff } from 'lucide-react';
import { userApi } from '@/api/endpoints';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { DashHeader, PillTabs } from '@/components/dashboard/DashUI';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

const TYPES = {
  order: { icon: Package, tone: 'from-brand to-brand-tint', label: 'Order' },
  payment: { icon: CreditCard, tone: 'from-[#2f8f5b] to-[#7ccf9e]', label: 'Payment' },
  account: { icon: User, tone: 'from-ink to-ink-soft', label: 'Account' },
  promo: { icon: Tag, tone: 'from-[#e2557a] to-[#f3a9bd]', label: 'Offer' },
  review: { icon: Star, tone: 'from-[#e7a33e] to-[#f5cf7c]', label: 'Review' },
};

function groupOf(date) {
  const d = new Date(date);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= start) return 'Today';
  if (d >= new Date(start.getTime() - 6 * 86400000)) return 'This week';
  return 'Earlier';
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => userApi.notifications({ limit: 50 }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: userApi.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: userApi.markAllRead, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: userApi.deleteNotification, onSuccess: invalidate });
  const all = data?.items || [];
  const items = filter === 'unread' ? all.filter((n) => !n.isRead) : all;
  const groups = ['Today', 'This week', 'Earlier'].map((g) => [g, items.filter((n) => groupOf(n.createdAt) === g)]).filter(([, list]) => list.length);

  return (
    <PageTransition>
      <Seo title="Notifications" noindex />
      <DashHeader
        icon={Bell}
        eyebrow="Inbox"
        title="Notifications"
        description="Order updates, payment confirmations and the occasional offer."
        action={
          data?.unread > 0 && (
            <Button variant="secondary" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => markAll.mutate()} loading={markAll.isPending}>
              Mark all as read
            </Button>
          )
        }
      />
      <PillTabs
        className="mt-6"
        id="notif-tabs"
        tabs={[
          ['all', 'All', 0],
          ['unread', 'Unread', data?.unread || 0],
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[1.5rem]" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !items.length ? (
          <EmptyState
            icon={filter === 'unread' ? CheckCheck : BellOff}
            title={filter === 'unread' ? 'No unread notifications' : 'You’re all caught up'}
            description="Order updates, payment confirmations and offers will appear here."
          />
        ) : (
          <div className="space-y-8">
            {groups.map(([label, list]) => (
              <section key={label}>
                <h2 className="mb-3 flex items-center gap-3 text-[11px] font-bold tracking-[0.2em] text-subtle uppercase">
                  {label}
                  <span className="h-px flex-1 bg-line" />
                </h2>
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {list.map((n, i) => {
                      const t = TYPES[n.type] || { icon: Bell, tone: 'from-ink to-ink-soft', label: 'Update' };
                      const Icon = t.icon;
                      return (
                        <motion.li
                          key={n._id}
                          layout
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                          exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
                          className={cn(
                            'group relative flex gap-4 overflow-hidden rounded-[1.5rem] border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-soft',
                            n.isRead ? 'border-line bg-surface' : 'border-brand/25 bg-gradient-to-r from-brand-soft/80 to-surface',
                          )}
                        >
                          {!n.isRead && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />}
                          <span className={cn('relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-soft', t.tone, n.isRead && 'opacity-70 saturate-50')}>
                            <Icon className="h-5 w-5" />
                            {!n.isRead && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-surface bg-brand" aria-label="Unread" />
                              </span>
                            )}
                          </span>
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              if (!n.isRead) markRead.mutate(n._id);
                              if (n.link) navigate(n.link);
                            }}
                          >
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-bold">{n.title}</span>
                              <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted uppercase">{t.label}</span>
                            </span>
                            <span className="mt-1 block text-sm text-muted">{n.message}</span>
                            <span className="mt-2 flex items-center gap-3 text-xs text-subtle">
                              {timeAgo(n.createdAt)}
                              {n.link && (
                                <span className="inline-flex items-center gap-1 font-semibold text-ink opacity-0 transition group-hover:opacity-100">
                                  Open <ArrowRight className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            onClick={() => remove.mutate(n._id)}
                            className="self-start rounded-full p-1.5 text-subtle opacity-100 transition hover:bg-sand hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                            aria-label="Delete notification"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
