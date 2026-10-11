import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, User, MapPin, CreditCard, RefreshCcw, AlertTriangle, StickyNote, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage } from '@/components/admin/AdminUI';
import { OrderTimeline, OrderStatusBadge, PaymentStatusBadge } from '@/components/order/OrderParts';
import { Input, Textarea, Select } from '@/components/ui/Form';
import { FullPageLoader, ErrorState, Badge } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { ORDER_STATUS_META } from '@/utils/constants';
import { formatPrice, formatDateTime } from '@/utils/format';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: order, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => adminApi.order(id) });
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState({ trackingNumber: '', carrier: '' });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (order) {
      setStatus(order.allowedTransitions?.[0] || '');
      setTracking({ trackingNumber: order.trackingNumber || '', carrier: order.carrier || 'Delhivery' });
      setNotes(order.adminNotes || '');
    }
  }, [order]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
  const update = useMutation({
    mutationFn: (body) => adminApi.updateOrderStatus(id, body),
    onSuccess: (res) => {
      toast.success(res.message);
      setNote('');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const refund = useMutation({
    mutationFn: (body) => adminApi.refundOrder(id, body),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const saveNotes = useMutation({ mutationFn: () => adminApi.orderNotes(id, notes), onSuccess: () => (toast.success('Notes saved'), invalidate()) });

  if (isLoading) return <FullPageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const a = order.shippingAddress;
  const submitStatus = async () => {
    if (!status) return;
    if (status === 'CANCELLED' && !(await confirm({ title: 'Cancel this order?', description: order.paymentStatus === 'PAID' ? 'Stock is returned and a full refund is issued via Razorpay.' : 'Reserved stock is released.', confirmText: 'Cancel order', tone: 'danger' }))) return;
    update.mutate({ status, note: note || undefined, ...(status === 'SHIPPED' ? tracking : {}) });
  };

  return (
    <AdminPage
      title={`Order ${order.orderNumber}`}
      description={`Placed ${formatDateTime(order.createdAt)}`}
      actions={
        <Button to="/admin/orders" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          All orders
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <OrderStatusBadge status={order.orderStatus} />
        <PaymentStatusBadge status={order.paymentStatus} />
        {order.refundStatus !== 'none' && <Badge tone="info">Refund {order.refundStatus}</Badge>}
      </div>
      {order.stockConflict && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl bg-warning-soft p-5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Payment arrived after the stock reservation expired and stock was insufficient. Restock the items or cancel & refund this order.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-2 font-bold">Items</h2>
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i._id} className="flex items-center gap-4 py-4">
                  <img src={i.image} alt="" className="h-16 w-14 rounded-xl bg-sand object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/products/${i.product}`} className="font-semibold hover:underline">
                      {i.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {i.sku} · {[i.color, i.size].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="text-sm text-muted tabular-nums">
                    {formatPrice(i.price)} × {i.quantity}
                  </p>
                  <p className="w-24 text-right font-bold tabular-nums">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 ml-auto max-w-xs space-y-2 border-t border-line pt-4 text-sm">
              {[
                ['Subtotal', formatPrice(order.subtotal)],
                order.discount > 0 && [`Discount (${order.coupon?.code})`, `− ${formatPrice(order.discount)}`],
                ['Shipping', order.shippingFee ? formatPrice(order.shippingFee) : 'Free'],
                ['GST included', formatPrice(order.tax)],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="mb-6 font-bold">Timeline</h2>
            <OrderTimeline order={order} />
            <ul className="mt-6 space-y-2 border-t border-line pt-4 text-xs text-muted">
              {[...order.statusHistory].reverse().map((h, i) => (
                <li key={i}>
                  <b className="text-ink">{ORDER_STATUS_META[h.status]?.label || h.status}</b> · {formatDateTime(h.at)}
                  {h.note ? ` — ${h.note}` : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="h-4 w-4" /> Update status
            </h2>
            {order.allowedTransitions?.length ? (
              <div className="mt-4 space-y-4">
                <Select label="New status" value={status} onChange={(e) => setStatus(e.target.value)} options={order.allowedTransitions.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label }))} />
                {status === 'SHIPPED' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Carrier" value={tracking.carrier} onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))} />
                    <Input label="Tracking #" value={tracking.trackingNumber} onChange={(e) => setTracking((t) => ({ ...t, trackingNumber: e.target.value }))} />
                  </div>
                )}
                <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the order history" />
                <Button fullWidth onClick={submitStatus} loading={update.isPending} variant={status === 'CANCELLED' ? 'danger' : 'primary'}>
                  {status === 'CANCELLED' ? 'Cancel order' : `Mark as ${ORDER_STATUS_META[status]?.label.toLowerCase()}`}
                </Button>
                <p className="text-xs text-muted">The customer is notified in-app{['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status) ? ' and by email' : ''}.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">This order is in a final state.</p>
            )}
          </section>

          {order.paymentStatus === 'PAID' && ['CANCELLED', 'RETURNED'].includes(order.orderStatus) && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 font-bold">
                <RefreshCcw className="h-4 w-4" /> Refund
              </h2>
              <p className="mt-2 text-sm text-muted">Refund status: {order.refundStatus}. Retry the Razorpay refund or record a manual refund.</p>
              <div className="mt-4 flex flex-col gap-2">
                <Button size="sm" onClick={() => refund.mutate({})} loading={refund.isPending}>
                  Refund {formatPrice(order.total)} via Razorpay
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (await confirm({ title: 'Mark as refunded?', description: 'Use this only if you refunded the customer outside Razorpay.', confirmText: 'Mark refunded' })) refund.mutate({ manual: true });
                  }}
                >
                  Record manual refund
                </Button>
              </div>
            </section>
          )}

          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <User className="h-4 w-4" /> Customer
            </h2>
            <p className="mt-3 font-semibold">{order.contact?.name}</p>
            <p className="text-sm text-muted">{order.contact?.email}</p>
            <p className="text-sm text-muted">{order.contact?.phone}</p>
            {order.user?._id && (
              <Link to={`/admin/customers/${order.user._id}`} className="mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline">
                View customer profile →
              </Link>
            )}
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <MapPin className="h-4 w-4" /> Shipping address
            </h2>
            <address className="mt-3 text-sm leading-6 text-muted not-italic">
              <b className="text-ink">{a.fullName}</b>
              <br />
              {a.address}
              {a.apartment ? `, ${a.apartment}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              {a.country} · {a.phone}
            </address>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <CreditCard className="h-4 w-4" /> Payment
            </h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Razorpay order</dt>
                <dd className="truncate font-mono text-xs">{order.payment?.razorpayOrderId || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Payment ID</dt>
                <dd className="truncate font-mono text-xs">{order.payment?.razorpayPaymentId || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Method</dt>
                <dd className="font-semibold uppercase">{order.payment?.method || '—'}</dd>
              </div>
              {order.paidAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Paid at</dt>
                  <dd>{formatDateTime(order.paidAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <StickyNote className="h-4 w-4" /> Internal notes
            </h2>
            <Textarea className="mt-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only visible to admins" aria-label="Internal notes" />
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => saveNotes.mutate()} loading={saveNotes.isPending} disabled={notes === (order.adminNotes || '')}>
              Save notes
            </Button>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
