import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Package, ArrowRight, Mail } from 'lucide-react';
import { orderApi } from '@/api/endpoints';
import { FullPageLoader, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatPrice, formatDate } from '@/utils/format';

const confetti = Array.from({ length: 18 }, (_, i) => ({
  x: Math.cos((i / 18) * Math.PI * 2) * (120 + (i % 3) * 30),
  y: Math.sin((i / 18) * Math.PI * 2) * (120 + (i % 3) * 30),
  c: ['#B9A8E8', '#6D5BD0', '#F2B33D', '#9DB8A0', '#EBB8B8'][i % 5],
}));

export default function OrderSuccess() {
  const { id } = useParams();
  const { data: order, isLoading, error, refetch } = useQuery({ queryKey: ['order', id], queryFn: () => orderApi.get(id) });
  if (isLoading) return <FullPageLoader label="Loading your order" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const eta = new Date(new Date(order.createdAt).getTime() + 4 * 86400000);

  return (
    <div className="container-page py-14 lg:py-20">
      <Seo title="Order confirmed" noindex />
      <div className="mx-auto max-w-2xl text-center">
        <div className="relative mx-auto h-24 w-24">
          {confetti.map((p, i) => (
            <motion.span key={i} className="absolute top-1/2 left-1/2 h-2.5 w-2.5 rounded-full" style={{ background: p.c }} initial={{ x: 0, y: 0, opacity: 1, scale: 0 }} animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }} transition={{ duration: 1.2, delay: 0.25, ease: 'easeOut' }} aria-hidden />
          ))}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200 }} className="grid h-24 w-24 place-items-center rounded-full bg-success text-white shadow-[0_20px_40px_-15px_rgb(47_143_91/0.7)]">
            <motion.span initial={{ pathLength: 0, opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Check className="h-11 w-11" strokeWidth={3} />
            </motion.span>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="eyebrow mt-10">Payment successful</p>
          <h1 className="display mt-3 text-5xl">
            Thank you, <span className="serif-accent text-brand">{order.contact?.name?.split(' ')[0] || 'friend'}.</span>
          </h1>
          <p className="mt-4 text-muted">
            Your order <b className="text-ink">{order.orderNumber}</b> is confirmed. We’ve sent a receipt to <b className="text-ink">{order.contact?.email}</b>.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card mt-10 p-6 text-left sm:p-8">
          <div className="grid gap-4 border-b border-line pb-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Order total</p>
              <p className="text-lg font-bold">{formatPrice(order.total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Payment</p>
              <p className="text-lg font-bold text-success">Paid</p>
            </div>
            <div>
              <p className="text-xs text-muted">Estimated delivery</p>
              <p className="text-lg font-bold">{formatDate(eta, { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-4">
            {order.items.map((i) => (
              <li key={i._id} className="flex items-center gap-4">
                <img src={i.image} alt="" className="h-16 w-14 rounded-xl bg-sand object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="text-sm text-muted">
                    {[i.color, i.size].filter(Boolean).join(' · ')} × {i.quantity}
                  </p>
                </div>
                <p className="font-semibold">{formatPrice(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-sand p-4 text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p className="text-muted">
              Shipping to <b className="text-ink">{order.shippingAddress.fullName}</b>, {order.shippingAddress.address}, {order.shippingAddress.city} {order.shippingAddress.pincode}
            </p>
          </div>
        </motion.div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to={`/orders/${order._id}`} leftIcon={<Package className="h-4 w-4" />}>
            Track order
          </Button>
          <Button to="/products" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Continue shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
