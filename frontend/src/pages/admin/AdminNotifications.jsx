import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Send, Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, userApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage } from '@/components/admin/AdminUI';
import { Input, Textarea, Select } from '@/components/ui/Form';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm({ defaultValues: { audience: 'user', email: '', type: 'order', title: '', message: '', link: '' } });
  const audience = watch('audience');
  const inbox = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => userApi.notifications({ limit: 30 }) });
  const sent = useQuery({ queryKey: ['admin', 'notifications', 'sent'], queryFn: adminApi.sentNotifications });
  const send = useMutation({
    mutationFn: (v) => adminApi.sendNotification({ ...v, email: v.audience === 'user' ? v.email : undefined }),
    onSuccess: (res) => {
      toast.success(res.message);
      reset({ audience: 'user', email: '', type: 'order', title: '', message: '', link: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications', 'sent'] });
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  const markAll = useMutation({ mutationFn: userApi.markAllRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const markRead = useMutation({ mutationFn: userApi.markRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });

  const onSubmit = async (v) => {
    if (v.audience === 'all' && !(await confirm({ title: 'Notify every customer?', description: 'This sends an in-app notification to all active customers.', confirmText: 'Send to everyone' }))) return;
    send.mutate(v);
  };

  return (
    <AdminPage title="Notifications" description="Your alerts, and in-app messages to customers.">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Your notifications</h2>
            {inbox.data?.unread > 0 && (
              <Button size="xs" variant="secondary" leftIcon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => markAll.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
          <p className="text-sm text-muted">New orders, return requests, reported reviews and contact messages.</p>
          {inbox.isLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : inbox.data?.items?.length ? (
            <ul className="mt-4 space-y-2">
              {inbox.data.items.map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => {
                      if (!n.isRead) markRead.mutate(n._id);
                      if (n.link) navigate(n.link);
                    }}
                    className={cn('flex w-full gap-3 rounded-2xl border p-4 text-left transition hover:shadow-soft', n.isRead ? 'border-line' : 'border-brand/30 bg-brand-soft/40')}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-line-strong' : 'bg-brand')} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{n.title}</span>
                      <span className="block text-sm text-muted">{n.message}</span>
                      <span className="block text-xs text-subtle">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Bell} title="All caught up" />
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Send a customer notification</h2>
            <p className="text-sm text-muted">Appears in the customer’s notification centre and navbar bell.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
              <Select label="Audience" options={[{ value: 'user', label: 'One customer' }, { value: 'all', label: 'All customers' }]} {...register('audience')} />
              <Select
                label="Type"
                options={[
                  { value: 'order', label: 'Order update' },
                  { value: 'payment', label: 'Payment' },
                  { value: 'promo', label: 'Promotion' },
                  { value: 'account', label: 'Account' },
                ]}
                {...register('type')}
              />
              {audience === 'user' && <Input className="sm:col-span-2" label="Customer email" type="email" required error={errors.email?.message} {...register('email', { required: 'Enter the customer email' })} />}
              <Input className="sm:col-span-2" label="Title" required error={errors.title?.message} {...register('title', { required: 'Add a title' })} />
              <Textarea className="sm:col-span-2" label="Message" rows={3} required error={errors.message?.message} {...register('message', { required: 'Add a message' })} />
              <Input className="sm:col-span-2" label="Link" optional placeholder="/orders or /products?category=tumblers" error={errors.link?.message} {...register('link')} />
              <div className="sm:col-span-2">
                <Button type="submit" loading={send.isPending} leftIcon={<Send className="h-4 w-4" />}>
                  Send notification
                </Button>
              </div>
            </form>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Recently sent</h2>
            <ul className="mt-3 divide-y divide-line">
              {(sent.data || []).map((s) => (
                <li key={s._id} className="py-3 text-sm">
                  <p>{s.description}</p>
                  <p className="text-xs text-muted">
                    {s.admin?.name} · {timeAgo(s.createdAt)}
                  </p>
                </li>
              ))}
              {sent.data && !sent.data.length && <li className="py-3 text-sm text-muted">Nothing sent yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
