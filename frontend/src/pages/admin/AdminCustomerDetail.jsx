import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Ban, CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, StatCard } from '@/components/admin/AdminUI';
import { OrderStatusBadge } from '@/components/order/OrderParts';
import { FullPageLoader, ErrorState, Badge, EmptyState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatPrice, formatDate, initials } from '@/utils/format';

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const me = useAuthStore((s) => s.user);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'customer', id], queryFn: () => adminApi.customer(id) });
  const update = useMutation({
    mutationFn: (body) => adminApi.updateCustomer(id, body),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <FullPageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { user, orders, addresses, stats } = data;
  const self = me?._id === user._id;

  return (
    <AdminPage
      title={user.name}
      description={`Customer since ${formatDate(user.createdAt)}`}
      actions={
        <Button to="/admin/customers" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          All customers
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center gap-4">
              {user.avatar?.url ? <img src={user.avatar.url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-lg font-bold text-white">{initials(user.name)}</span>}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{user.name}</p>
                <div className="mt-1 flex gap-1">
                  <Badge tone={user.isActive ? 'success' : 'danger'} dot>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                  {user.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                </div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-muted">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${user.email}`} className="hover:text-ink">
                  {user.email}
                </a>
              </li>
              <li className="flex items-center gap-2 text-muted">
                <Phone className="h-4 w-4" /> {user.phone || 'No phone'}
              </li>
            </ul>
            {!self && (
              <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
                {user.isActive ? (
                  <Button
                    variant="danger-soft"
                    size="sm"
                    leftIcon={<Ban className="h-4 w-4" />}
                    loading={update.isPending}
                    onClick={async () => {
                      if (await confirm({ title: `Disable ${user.name}?`, description: 'They will be signed out everywhere immediately and won’t be able to sign in until re-enabled.', confirmText: 'Disable account', tone: 'danger' })) update.mutate({ isActive: false });
                    }}
                  >
                    Disable account
                  </Button>
                ) : (
                  <Button size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} loading={update.isPending} onClick={() => update.mutate({ isActive: true })}>
                    Re-activate account
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ShieldCheck className="h-4 w-4" />}
                  onClick={async () => {
                    const toAdmin = user.role !== 'admin';
                    if (await confirm({ title: toAdmin ? 'Grant admin access?' : 'Remove admin access?', description: toAdmin ? 'Admins can manage products, orders, customers and settings.' : 'They will become a regular customer.', confirmText: toAdmin ? 'Make admin' : 'Remove admin', tone: toAdmin ? 'default' : 'danger' })) update.mutate({ role: toAdmin ? 'admin' : 'user' });
                  }}
                >
                  {user.role === 'admin' ? 'Remove admin role' : 'Make admin'}
                </Button>
              </div>
            )}
          </section>
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <MapPin className="h-4 w-4" /> Addresses
            </h2>
            {addresses.length ? (
              <ul className="mt-3 space-y-3">
                {addresses.map((a) => (
                  <li key={a._id} className="rounded-2xl bg-sand p-3 text-sm leading-6 text-muted">
                    <b className="text-ink">{a.label}</b> {a.isDefault && '· Default'}
                    <br />
                    {a.address}, {a.city}, {a.state} {a.pincode}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No saved addresses.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Paid orders" value={stats.orders} />
            <StatCard label="Lifetime value" value={formatPrice(stats.spent)} tone="bg-success-soft text-success" />
          </div>
          <section className="card p-6">
            <h2 className="mb-2 font-bold">Order history</h2>
            {orders.length ? (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o._id}>
                    <Link to={`/admin/orders/${o._id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-sand">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{o.orderNumber}</p>
                        <p className="text-xs text-muted">
                          {formatDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <OrderStatusBadge status={o.orderStatus} />
                      <span className="w-24 text-right text-sm font-bold tabular-nums">{formatPrice(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No orders yet" description="This customer hasn’t completed a purchase." />
            )}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
