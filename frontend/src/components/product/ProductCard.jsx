import { memo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Eye, Plus, Check } from 'lucide-react';
import { RatingStars, PriceDisplay } from '@/components/ui/Commerce';
import { Badge, Skeleton } from '@/components/ui/Feedback';
import { StaggerItem } from '@/components/ui/Motion';
import { TiltCard } from '@/components/ui/Effects';
import { useWishlist, useToggleWishlist } from '@/hooks/useWishlist';
import { useCartActions } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

export function WishlistButton({ product, className, size = 'md' }) {
  const { has } = useWishlist();
  const toggle = useToggleWishlist();
  const active = has(product._id);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ product, inWishlist: active });
      }}
      className={cn(
        'grid place-items-center rounded-full bg-surface/90 shadow-soft backdrop-blur transition hover:bg-surface',
        size === 'lg' ? 'h-12 w-12 border border-line-strong' : 'h-9 w-9',
        className,
      )}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      aria-pressed={active}
    >
      <motion.span key={String(active)} initial={{ scale: 0.6 }} animate={{ scale: [0.6, 1.25, 1] }} transition={{ duration: 0.35 }}>
        <Heart className={cn(size === 'lg' ? 'h-5 w-5' : 'h-4 w-4', active ? 'fill-[#E2557A] text-[#E2557A]' : 'text-ink')} />
      </motion.span>
    </motion.button>
  );
}

function ProductCard({ product, priority = false, className }) {
  const openQuickView = useUIStore((s) => s.openQuickView);
  const { add } = useCartActions();
  const [added, setAdded] = useState(false);
  const [hover, setHover] = useState(false);
  const [preview, setPreview] = useState(null); // colour swatch hovered → that colourway's image
  const imageRef = useRef(null);
  const flyToCart = useUIStore((s) => s.flyToCart);
  const images = product.images || [];
  const second = preview === null ? images[1]?.url : null;
  const primary = images[preview ?? 0]?.url || images[0]?.url;
  const outOfStock = product.stock <= 0;
  const needsVariant = product.colors?.length > 1 || product.sizes?.length > 1;

  const quickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (needsVariant) return openQuickView(product.slug);
    add.mutate(
      { product, quantity: 1, color: product.colors?.[0]?.name || '', size: product.sizes?.[0] || '' },
      {
        onSuccess: () => {
          flyToCart(imageRef.current);
          setAdded(true);
          setTimeout(() => setAdded(false), 1600);
        },
      },
    );
  };

  return (
    <article className={cn('group relative', className)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link to={`/products/${product.slug}`} className="block rounded-[1.75rem] focus-visible:outline-offset-4" aria-label={product.name}>
        <TiltCard className="rounded-[1.75rem]" max={6}>
        <div ref={imageRef} className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-sand">
          <img
            src={primary}
            alt={images[0]?.alt || product.name}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={cn('absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)]', second && hover ? 'opacity-0' : 'opacity-100', 'group-hover:scale-[1.04]')}
          />
          {second && (
            <img
              src={second}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn('absolute inset-0 h-full w-full scale-[1.04] object-cover transition-opacity duration-700', hover ? 'opacity-100' : 'opacity-0')}
              aria-hidden
            />
          )}

          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {outOfStock ? (
              <Badge tone="dark">Sold out</Badge>
            ) : (
              <>
                {product.discount >= 20 && <Badge tone="brand">−{product.discount}%</Badge>}
                {product.isNewArrival && <Badge className="bg-surface/90 text-ink">New</Badge>}
                {product.isBestSeller && !product.isNewArrival && <Badge className="bg-surface/90 text-ink">Bestseller</Badge>}
                {product.stockStatus === 'low_stock' && <Badge tone="warning">Only {product.stock} left</Badge>}
              </>
            )}
          </div>

          <WishlistButton product={product} className="absolute top-3 right-3" />

          {/* Hover actions (always visible on touch devices) */}
          <div className="absolute inset-x-3 bottom-3 flex gap-2 transition duration-300 [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
            <button
              type="button"
              onClick={quickAdd}
              disabled={outOfStock || add.isPending}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[13px] font-semibold text-white shadow-lift transition hover:bg-ink-soft disabled:bg-ink/60"
            >
              <AnimatePresence mode="wait" initial={false}>
                {add.isPending ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : added ? (
                  <motion.span key="d" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Added
                  </motion.span>
                ) : (
                  <motion.span key="a" initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="sm:hidden">{outOfStock ? 'Sold out' : needsVariant ? 'Options' : 'Add'}</span>
                    <span className="hidden sm:inline">{outOfStock ? 'Sold out' : needsVariant ? 'Choose options' : 'Quick add'}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openQuickView(product.slug);
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-lift transition hover:bg-sand"
              aria-label={`Quick view ${product.name}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
        </TiltCard>

        <div className="mt-4 px-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.16em] text-subtle uppercase">{product.category?.name}</p>
              <h3 className="mt-1 truncate text-[15px] font-bold tracking-tight">{product.name}</h3>
            </div>
            {product.reviewCount > 0 && <RatingStars rating={product.rating} size={12} className="mt-5 hidden shrink-0 sm:inline-flex" />}
          </div>
          {product.reviewCount > 0 && <RatingStars rating={product.rating} size={11} count={product.reviewCount} className="mt-1 sm:hidden" />}
          <PriceDisplay price={product.price} mrp={product.mrp} size="sm" className="mt-1.5" />
          {product.colors?.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5" aria-label={`${product.colors.length} colours`}>
              {product.colors.slice(0, 5).map((c, i) => (
                <span
                  key={c.name}
                  title={c.name}
                  onMouseEnter={() => i < images.length && setPreview(i)}
                  onMouseLeave={() => setPreview(null)}
                  className={cn('h-3.5 w-3.5 rounded-full ring-1 ring-black/10 ring-offset-1 transition-transform duration-200 hover:scale-125', preview === i && 'scale-125 ring-ink')}
                  style={{ background: c.hex }}
                />
              ))}
              {product.colors.length > 5 && <span className="text-xs text-muted">+{product.colors.length - 5}</span>}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}

export default memo(ProductCard);

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[4/5] w-full rounded-[1.75rem]" />
      <Skeleton className="mt-4 h-3 w-16" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/3" />
    </div>
  );
}

/** Responsive, staggered product grid with skeleton loading. */
export function ProductGrid({ products, loading, skeletonCount = 8, className, columns = 'grid-cols-2 lg:grid-cols-4' }) {
  if (loading) {
    return (
      <div className={cn('grid gap-x-4 gap-y-10 sm:gap-x-6', columns, className)} role="status" aria-label="Loading products">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <motion.div
      className={cn('grid gap-x-4 gap-y-10 sm:gap-x-6', columns, className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {products.map((p, i) => (
        <StaggerItem key={p._id}>
          <ProductCard product={p} priority={i < 4} />
        </StaggerItem>
      ))}
    </motion.div>
  );
}
