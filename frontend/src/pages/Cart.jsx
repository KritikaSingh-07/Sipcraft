import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, ArrowRight, Lock, Truck, Bookmark, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCart, useCartActions } from '@/hooks/useCart';
import { useProducts } from '@/hooks/queries';
import { couponApi } from '@/api/endpoints';
import { useConfirm } from '@/contexts/ConfirmContext';
import { CheckoutSummary, CouponInput } from '@/components/checkout/CheckoutParts';
import { QuantitySelector, PriceDisplay } from '@/components/ui/Commerce';
import { EmptyState, Skeleton, ErrorState } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { ProductGrid } from '@/components/product/ProductCard';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatPrice } from '@/utils/format';

function CartLine({ item, onQty, onRemove, onSave, saved }) {
  const p = item.product;
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30, height: 0 }} className="flex gap-4 py-6 sm:gap-6">
      <Link to={`/products/${p?.slug}`} className="h-32 w-24 shrink-0 overflow-hidden rounded-2xl bg-sand sm:h-36 sm:w-28">
        <img src={p?.image} alt={p?.name} className="h-full w-full object-cover" loading="lazy" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/products/${p?.slug}`} className="font-bold tracking-tight hover:underline">
              {p?.name || 'Unavailable product'}
            </Link>
            <p className="mt-1 text-sm text-muted">{[item.color, item.size].filter(Boolean).join(' · ') || 'Standard'}</p>
            {p && <PriceDisplay price={p.price} mrp={p.mrp} size="sm" className="mt-1.5" />}
          </div>
          <p className="hidden font-bold tabular-nums sm:block">{formatPrice(item.lineTotal)}</p>
        </div>
        {item.issue && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-danger">
            <AlertTriangle className="h-4 w-4" /> {item.issue}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          {!saved && <QuantitySelector size="sm" value={item.quantity} max={Math.max(1, Math.min(20, p?.stock || 1))} onChange={onQty} />}
          <button onClick={onSave} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
            <Bookmark className="h-3.5 w-3.5" /> {saved ? 'Move to cart' : 'Save for later'}
          </button>
          <button onClick={onRemove} className="text-[13px] font-semibold text-muted hover:text-danger">
            Remove
          </button>
        </div>
      </div>
    </motion.li>
  );
}

export default function Cart() {
  const { cart, isLoading, isAuthed, isError, refetch } = useCart();
  const { update, remove, clear, applyCoupon, removeCoupon } = useCartActions();
  const confirm = useConfirm();
  const { data: coupons } = useQuery({ queryKey: ['coupons', 'public'], queryFn: couponApi.publicList, staleTime: 5 * 60_000 });
  const { data: recs } = useProducts({ bestSeller: true, limit: 4, sort: 'popularity' }, { enabled: !isLoading && cart.items.length === 0 });
  const totals = cart.totals;
  const blocked = cart.items.some((i) => !i.available);

  if (isLoading) {
    return (
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-6">
              <Skeleton className="h-36 w-28 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <PageTransition className="container-page py-10 lg:py-14">
      <Seo title="Your cart" noindex />
      <h1 className="display text-5xl">Your cart</h1>

      {cart.items.length === 0 ? (
        <>
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is feeling light"
            description="Discover tumblers and sippers made for every part of your day."
            action={
              <Button to="/products" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Start shopping
              </Button>
            }
          />
          {recs?.items?.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-6 text-2xl font-bold tracking-tight">Customer favourites</h2>
              <ProductGrid products={recs.items} />
            </section>
          )}
        </>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
          <div>
            {totals?.amountToFreeShipping > 0 ? (
              <div className="rounded-2xl bg-sand p-4">
                <p className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-brand" /> Add <b>{formatPrice(totals.amountToFreeShipping)}</b> more for free shipping
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((totals.subtotal - totals.discount) / totals.freeShippingThreshold) * 100)}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-success-soft p-4 text-sm font-semibold text-success">
                <Truck className="h-4 w-4" /> Your order ships free
              </p>
            )}
            <ul className="divide-y divide-line border-b border-line">
              <AnimatePresence initial={false}>
                {cart.items.map((item) => (
                  <CartLine
                    key={item._id}
                    item={item}
                    onQty={(quantity) => update.mutate({ itemId: item._id, quantity })}
                    onRemove={() => remove.mutate(item._id)}
                    onSave={() => update.mutate({ itemId: item._id, savedForLater: true })}
                  />
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-4 flex justify-between">
              <Link to="/products" className="text-sm font-semibold underline-offset-4 hover:underline">
                ← Continue shopping
              </Link>
              <button
                onClick={async () => {
                  if (await confirm({ title: 'Clear your cart?', description: 'All items will be removed. Saved-for-later items stay.', confirmText: 'Clear cart', tone: 'danger' })) clear.mutate();
                }}
                className="text-sm font-semibold text-muted hover:text-danger"
              >
                Clear cart
              </button>
            </div>

            {cart.savedForLater?.length > 0 && (
              <section className="mt-14">
                <h2 className="text-xl font-bold tracking-tight">Saved for later ({cart.savedForLater.length})</h2>
                <ul className="divide-y divide-line">
                  {cart.savedForLater.map((item) => (
                    <CartLine key={item._id} item={item} saved onRemove={() => remove.mutate(item._id)} onSave={() => update.mutate({ itemId: item._id, savedForLater: false })} />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CheckoutSummary totals={totals} compact>
              <div className="mt-6">
                <CouponInput
                  appliedCode={cart.couponCode}
                  onApply={(code) => applyCoupon.mutateAsync(code)}
                  onRemove={() => removeCoupon.mutate()}
                  applying={applyCoupon.isPending}
                  disabled={!isAuthed}
                  disabledHint={
                    <>
                      <Link to="/login?redirect=/cart" className="font-semibold text-ink underline">
                        Sign in
                      </Link>{' '}
                      to apply coupons.
                    </>
                  }
                  suggestions={(coupons || []).filter((c) => (totals?.subtotal || 0) >= c.minimumOrderAmount)}
                />
              </div>
              {cart.couponError && <p className="mt-2 text-[13px] text-warning">{cart.couponError}</p>}
              <Button to={blocked ? undefined : '/checkout'} disabled={blocked} size="lg" fullWidth className="mt-6" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Checkout
              </Button>
              {blocked && <p className="mt-2 text-center text-[13px] font-semibold text-danger">Remove unavailable items to continue</p>}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" /> Secure checkout powered by Razorpay
              </p>
            </CheckoutSummary>
          </aside>
        </div>
      )}
    </PageTransition>
  );
}
