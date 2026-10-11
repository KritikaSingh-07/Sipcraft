import { motion } from 'framer-motion';
import { Check, X, PackageCheck, Truck, Home, ClipboardCheck, Package, RotateCcw, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Feedback';
import { ORDER_STATUS_META, PAYMENT_STATUS_META, ORDER_FLOW } from '@/utils/constants';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

export function OrderStatusBadge({ status, className }) {
  const meta = ORDER_STATUS_META[status] || { label: status, tone: 'neutral' };
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, className }) {
  const meta = PAYMENT_STATUS_META[status] || { label: status, tone: 'neutral' };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

const ICONS = { PLACED: ClipboardCheck, CONFIRMED: Check, PROCESSING: Package, SHIPPED: Truck, OUT_FOR_DELIVERY: Truck, DELIVERED: Home };

/** Vertical delivery timeline driven by the order's statusHistory. */
export function OrderTimeline({ order }) {
  const history = order.statusHistory || [];
  const at = (s) => history.filter((h) => h.status === s).slice(-1)[0]?.at;
  const terminal = ['CANCELLED', 'RETURN_REQUESTED', 'RETURNED'].includes(order.orderStatus) ? order.orderStatus : null;

  if (order.orderStatus === 'PENDING_PAYMENT') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
        <Clock className="h-5 w-5" /> Waiting for payment confirmation.
      </div>
    );
  }

  let steps = ORDER_FLOW.map((s) => ({ status: s, at: at(s) }));
  if (terminal === 'CANCELLED') steps = steps.filter((s) => s.at).concat({ status: 'CANCELLED', at: at('CANCELLED') });
  if (terminal === 'RETURN_REQUESTED' || terminal === 'RETURNED') {
    steps = steps.concat({ status: 'RETURN_REQUESTED', at: at('RETURN_REQUESTED') }, { status: 'RETURNED', at: at('RETURNED') });
  }
  const currentIndex = Math.max(0, steps.findIndex((s) => s.status === order.orderStatus));

  return (
    <ol className="relative" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const cancelled = s.status === 'CANCELLED';
        const Icon = cancelled ? X : s.status.startsWith('RETURN') ? RotateCcw : done && !current ? Check : ICONS[s.status] || PackageCheck;
        return (
          <li key={s.status} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute top-10 left-[19px] h-[calc(100%-2.5rem)] w-0.5 overflow-hidden bg-line" aria-hidden>
                <motion.span className="block w-full bg-ink" initial={{ height: 0 }} animate={{ height: i < currentIndex ? '100%' : 0 }} transition={{ duration: 0.6, delay: i * 0.12 }} />
              </span>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition',
                cancelled ? 'border-danger bg-danger text-white' : done ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-subtle',
                current && !cancelled && 'ring-4 ring-brand-soft',
              )}
            >
              <Icon className="h-4 w-4" />
            </motion.span>
            <div className="pt-2">
              <p className={cn('text-sm font-bold', !done && 'text-subtle')}>{ORDER_STATUS_META[s.status]?.label}</p>
              {s.at ? <p className="text-xs text-muted">{formatDateTime(s.at)}</p> : !done && <p className="text-xs text-subtle">Pending</p>}
              {current && s.status === 'SHIPPED' && order.trackingNumber && (
                <p className="mt-1 text-xs font-semibold">
                  {order.carrier || 'Courier'} · {order.trackingNumber}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
