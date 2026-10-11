import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, CreditCard, RotateCcw, XCircle, Star, Download, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { orderApi, paymentApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { openRazorpayCheckout } from '@/utils/razorpay';
import { OrderTimeline, OrderStatusBadge, PaymentStatusBadge } from '@/components/order/OrderParts';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatPrice, formatDate, formatDateTime } from '@/utils/format';

export default function OrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: order, isLoading, error, refetch } = useQuery({ queryKey: ['order', id], queryFn: () => orderApi.get(id) });
  const [dialog, setDialog] = useState(null); // 'cancel' | 'return'
  const [reason, setReason] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(id, reason || undefined),
    onSuccess: () => {
      toast.success('Order cancelled');
      setDialog(null);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const requestReturn = useMutation({
    mutationFn: () => orderApi.requestReturn(id, reason),
    onSuccess: () => {
      toast.success('Return requested — we’ll be in touch shortly');
      setDialog(null);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const retry = useMutation({
    mutationFn: async () => {
      const rzpOrder = await paymentApi.retry(id);
      const response = await openRazorpayCheckout(rzpOrder, {
        onFailure: (err) => paymentApi.failed({ razorpay_order_id: rzpOrder.razorpayOrderId, reason: err?.description }).catch(() => {}),
      });
      return paymentApi.verify(response);
    },
    onSuccess: () => {
      toast.success('Payment successful!');
      refresh();
    },
    onError: (e) => e?.reason !== 'dismissed' && toast.error(getErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (error?.response?.status === 404) return <EmptyState icon={PackageX} title="Order not found" description="This order doesn’t exist or belongs to another account." action={<Button to="/orders">Back to orders</Button>} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const a = order.shippingAddress;
  const reviewed = new Set(order.reviewedProducts || []);
  const canReview = ['DELIVERED', 'RETURN_REQUESTED'].includes(order.orderStatus);

  return (
    <PageTransition>
      <Seo title={`Order ${order.orderNumber}`} noindex />
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>
      <div className="relative mt-4 overflow-hidden rounded-[2rem] bg-ink p-6 text-white sm:p-8">
        <div aria-hidden className="aurora-blob -top-24 -right-16 h-64 w-64 animate-aurora bg-brand" />
        <div aria-hidden className="aurora-blob -bottom-28 left-1/4 h-56 w-56 animate-aurora-alt bg-[#e2557a]/50" />
        <div aria-hidden className="grain absolute inset-0" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-white/55 uppercase">Order details</p>
            <h1 className="display mt-2 text-3xl sm:text-4xl">
              #{order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Placed on {formatDateTime(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <OrderStatusBadge status={order.orderStatus} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/55">Order total</p>
            <p className="text-3xl font-extrabold tracking-tight">{formatPrice(order.total)}</p>
          </div>
        </div>
      </div>

      {order.canRetryPayment && (
        <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-warning-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-warning">
            <b>Payment pending.</b> Complete payment before {formatDateTime(order.reservationExpiresAt)} to keep your items reserved.
          </p>
          <Button size="sm" onClick={() => retry.mutate()} loading={retry.isPending} leftIcon={<CreditCard className="h-4 w-4" />}>
            Pay {formatPrice(order.total)}
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft sm:p-7">
            <h2 className="mb-6 text-lg font-bold tracking-tight">Tracking</h2>
            <OrderTimeline order={order} />
            {order.cancelReason && <p className="mt-6 rounded-2xl bg-sand p-4 text-sm text-muted">Reason: {order.cancelReason}</p>}
            {order.refundStatus && order.refundStatus !== 'none' && (
              <p className="mt-3 rounded-2xl bg-info-soft p-4 text-sm text-info">
                Refund {order.refundStatus === 'processed' ? `of ${formatPrice(order.refundAmount || order.total)} processed${order.refundedAt ? ` on ${formatDate(order.refundedAt)}` : ''}` : order.refundStatus === 'pending' ? 'is being processed' : 'is under review by our team'}.
              </p>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft sm:p-7">
            <h2 className="mb-2 text-lg font-bold tracking-tight">Items</h2>
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i._id} className="flex gap-4 py-4">
                  <Link to={`/products/${i.slug}`} className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-sand">
                    <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/products/${i.slug}`} className="font-bold hover:underline">
                      {i.name}
                    </Link>
                    <p className="text-sm text-muted">{[i.color, i.size].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1 text-sm">
                      {formatPrice(i.price)} × {i.quantity}
                    </p>
                    {canReview && (
                      reviewed.has(String(i.product)) ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <Star className="h-3.5 w-3.5" fill="currentColor" /> Reviewed
                        </p>
                      ) : (
                        <Link to={`/products/${i.slug}#reviews`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                          <Star className="h-3.5 w-3.5" /> Write a review
                        </Link>
                      )
                    )}
                  </div>
                  <p className="font-bold tabular-nums">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft sm:p-7">
            <h2 className="text-lg font-bold tracking-tight">Payment summary</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Coupon {order.coupon?.code}</dt>
                  <dd className="font-semibold">− {formatPrice(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-semibold">{order.shippingFee ? formatPrice(order.shippingFee) : 'Free'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">GST included</dt>
                <dd className="font-semibold">{formatPrice(order.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{formatPrice(order.total)}</dd>
              </div>
            </dl>
            {order.payment?.razorpayPaymentId && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl bg-sand p-3 text-xs text-muted">
                <CreditCard className="h-4 w-4" /> {order.payment.method ? `${order.payment.method.toUpperCase()} · ` : ''}
                {order.payment.razorpayPaymentId}
              </p>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft sm:p-7">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <MapPin className="h-4 w-4" /> Shipping to
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

          <div className="space-y-2">
            {order.canCancel && (
              <Button variant="danger-soft" fullWidth leftIcon={<XCircle className="h-4 w-4" />} onClick={() => { setReason(''); setDialog('cancel'); }}>
                Cancel order
              </Button>
            )}
            {order.canReturn && (
              <Button variant="secondary" fullWidth leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => { setReason(''); setDialog('return'); }}>
                Request a return
              </Button>
            )}
            <Button variant="ghost" fullWidth leftIcon={<Download className="h-4 w-4" />} onClick={() => window.print()}>
              Print invoice
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog === 'cancel' ? 'Cancel this order?' : 'Request a return'}
        description={
          dialog === 'cancel'
            ? order.paymentStatus === 'PAID'
              ? 'Your refund will be issued to the original payment method within 5–7 business days.'
              : 'Your reserved items will be released.'
            : 'Our courier partner will pick up the items within 2 business days.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep order
            </Button>
            <Button
              variant={dialog === 'cancel' ? 'danger' : 'primary'}
              loading={cancel.isPending || requestReturn.isPending}
              disabled={dialog === 'return' && reason.trim().length < 5}
              onClick={() => (dialog === 'cancel' ? cancel.mutate() : requestReturn.mutate())}
            >
              {dialog === 'cancel' ? 'Cancel order' : 'Submit request'}
            </Button>
          </>
        }
      >
        <Textarea
          label={dialog === 'cancel' ? 'Reason (optional)' : 'Why are you returning this?'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={dialog === 'cancel' ? 'Ordered by mistake, changed my mind…' : 'Wrong colour, damaged in transit…'}
        />
      </Modal>
    </PageTransition>
  );
}
