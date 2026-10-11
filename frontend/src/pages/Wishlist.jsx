import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useWishlist, useToggleWishlist } from '@/hooks/useWishlist';
import { useCartActions } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { PriceDisplay, StockBadge } from '@/components/ui/Commerce';
import { EmptyState } from '@/components/ui/Feedback';
import { ProductCardSkeleton } from '@/components/product/ProductCard';
import { PageTransition } from '@/components/ui/Motion';
import { DashHeader } from '@/components/dashboard/DashUI';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { cn } from '@/utils/cn';

export default function Wishlist({ embedded = false }) {
  const { items, isLoading } = useWishlist({ withProducts: true });
  const toggle = useToggleWishlist();
  const { add } = useCartActions();
  const openQuickView = useUIStore((s) => s.openQuickView);
  const status = useAuthStore((s) => s.status);

  const moveToCart = (p) => {
    if (p.colors?.length > 1 || p.sizes?.length > 1) return openQuickView(p.slug);
    add.mutate(
      { product: p, quantity: 1, color: p.colors?.[0]?.name || '', size: p.sizes?.[0] || '' },
      { onSuccess: () => toggle.mutate({ product: p, inWishlist: true }) },
    );
  };

  return (
    <PageTransition className={cn(!embedded && 'container-page py-10 lg:py-14')}>
      <Seo title="Wishlist" noindex />
      {embedded ? (
        <DashHeader
          icon={Heart}
          eyebrow="Saved for you"
          title="Your"
          accent="wishlist."
          description="Everything you’ve hearted, in one place. Move them to your cart when you’re ready."
          action={items.length > 0 && <p className="text-sm text-muted">{items.length} saved item{items.length === 1 ? '' : 's'}</p>}
        />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Saved for you</p>
            <h1 className="display mt-3 text-5xl">Wishlist</h1>
          </div>
          {items.length > 0 && <p className="text-sm text-muted">{items.length} saved item{items.length === 1 ? '' : 's'}</p>}
        </div>
      )}
      {status === 'guest' && items.length > 0 && (
        <p className="mt-4 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-dark">
          <Link to="/login?redirect=/wishlist" className="font-bold underline">
            Sign in
          </Link>{' '}
          to keep your wishlist across devices.
        </p>
      )}

      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Heart} title="Nothing saved yet" description="Tap the heart on any product to keep it here for later." action={<Button to="/products">Discover products</Button>} />
      ) : (
        <ul className={cn('mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6', embedded ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
          <AnimatePresence>
            {items.map((p) => (
              <motion.li key={p._id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <div className="group relative">
                  <Link to={`/products/${p.slug}`} className="block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-sand">
                    <img src={p.images?.[0]?.url} alt={p.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                  </Link>
                  <button
                    onClick={() => toggle.mutate({ product: p, inWishlist: true })}
                    className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 shadow-soft backdrop-blur hover:bg-surface"
                    aria-label={`Remove ${p.name} from wishlist`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Link to={`/products/${p.slug}`} className="mt-4 block truncate font-bold tracking-tight">
                  {p.name}
                </Link>
                <PriceDisplay price={p.price} mrp={p.mrp} size="sm" className="mt-1" />
                <StockBadge product={p} className="mt-2" />
                <Button size="sm" variant={p.stock > 0 ? 'primary' : 'secondary'} fullWidth className="mt-4" disabled={p.stock <= 0} onClick={() => moveToCart(p)} leftIcon={<ShoppingBag className="h-4 w-4" />}>
                  {p.stock > 0 ? 'Move to cart' : 'Out of stock'}
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </PageTransition>
  );
}
