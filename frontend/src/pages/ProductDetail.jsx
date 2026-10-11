import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Zap, Truck, RotateCcw, ShieldCheck, ChevronRight, Plus, Minus, Check, PackageX } from 'lucide-react';
import { useProduct, useProducts, useSettings } from '@/hooks/queries';
import { useCartActions } from '@/hooks/useCart';
import { useRecentStore } from '@/store/guestStore';
import { useAuthStore } from '@/store/authStore';
import { ProductGallery, ColorSelector, SizeSelector } from '@/components/product/ProductOptions';
import ProductCard, { WishlistButton, ProductGrid } from '@/components/product/ProductCard';
import ReviewSection from '@/components/product/Reviews';
import { RatingStars, PriceDisplay, QuantitySelector, StockBadge } from '@/components/ui/Commerce';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageTransition, Reveal } from '@/components/ui/Motion';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { SITE_URL } from '@/utils/constants';
import { cn } from '@/utils/cn';

function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => (
        <div key={item.title}>
          <h3>
            <button className="flex w-full items-center justify-between py-5 text-left font-bold" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} aria-controls={`acc-${i}`}>
              {item.title}
              {open === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div id={`acc-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="pb-6 text-[15px] leading-7 text-muted">{item.content}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-2 lg:gap-16">
      <Skeleton className="aspect-[4/5] w-full rounded-[2rem]" />
      <div className="space-y-5 pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

function RecentlyViewed({ currentId }) {
  const ids = useRecentStore((s) => s.ids).filter((id) => id !== currentId).slice(0, 4);
  const { data, isLoading } = useProducts({ ids: ids.join(','), limit: 4 }, { enabled: ids.length > 0 });
  if (!ids.length || (!isLoading && !data?.items?.length)) return null;
  return (
    <section className="container-page mt-24">
      <h2 className="display mb-8 text-3xl sm:text-4xl">Recently viewed</h2>
      <ProductGrid products={data?.items || []} loading={isLoading} skeletonCount={ids.length} />
    </section>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useProduct(slug);
  const product = data?.product;
  const pushRecent = useRecentStore((s) => s.push);
  const status = useAuthStore((s) => s.status);
  const { add } = useCartActions();
  const { data: settings } = useSettings();
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!product) return;
    pushRecent(product._id);
    setColor(product.colors?.[0]?.name || '');
    setSize(product.sizes?.[product.sizes.length - 1] || '');
    setQty(1);
    setImageIndex(0);
  }, [product, pushRecent]);

  const chooseColor = (name) => {
    setColor(name);
    const i = product.colors.findIndex((c) => c.name === name);
    if (i >= 0 && i < product.images.length) setImageIndex(i);
  };

  const jsonLd = useMemo(
    () =>
      product && {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        brand: { '@type': 'Brand', name: product.brand || 'Sipcraft' },
        description: product.shortDescription || product.description,
        image: product.images.map((i) => (i.url.startsWith('http') ? i.url : `${SITE_URL}${i.url}`)),
        offers: {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: product.price,
          availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${SITE_URL}/products/${product.slug}`,
        },
        ...(product.reviewCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
      },
    [product],
  );

  if (isLoading) return <DetailSkeleton />;
  if (error?.response?.status === 404) {
    return (
      <EmptyState
        icon={PackageX}
        title="This product isn’t available"
        description="It may have been retired or the link is incorrect."
        action={<Button to="/products">Browse the collection</Button>}
      />
    );
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const outOfStock = product.stock <= 0;
  const addToCart = (opts) =>
    add.mutate(
      { product, quantity: qty, color, size },
      {
        onSuccess: () => {
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 1800);
          opts?.onSuccess?.();
        },
      },
    );
  const buyNow = () =>
    addToCart({ onSuccess: () => navigate(status === 'authenticated' ? '/checkout' : '/login?redirect=/checkout') });

  const details = [
    { title: 'Description', content: <div className="space-y-3 whitespace-pre-line">{product.description}</div> },
    {
      title: 'Specifications',
      content: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2.5">
          {[['Capacity', product.capacity], ['Material', product.material], ...product.specifications.map((s) => [s.key, s.value]), ['SKU', product.sku]]
            .filter(([, v]) => v)
            .filter(([k], i, arr) => arr.findIndex(([k2]) => k2 === k) === i)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-semibold text-ink">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      ),
    },
    product.features?.length && {
      title: 'Features',
      content: (
        <ul className="space-y-2">
          {product.features.map((f) => (
            <li key={f} className="flex gap-2.5">
              <Check className="mt-1 h-4 w-4 shrink-0 text-success" /> {f}
            </li>
          ))}
        </ul>
      ),
    },
    product.careInstructions?.length && {
      title: 'Care instructions',
      content: (
        <ul className="list-disc space-y-1.5 pl-5">
          {product.careInstructions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ),
    },
    { title: 'Shipping', content: product.shippingInfo || 'Ships within 24 hours. Free delivery on orders above ₹999.' },
    { title: 'Returns', content: product.returnInfo || settings?.returnPolicy || 'Easy 7-day returns on unused products.' },
  ].filter(Boolean);

  return (
    <PageTransition>
      <Seo title={product.name} description={product.shortDescription} image={product.images[0]?.url} type="product" jsonLd={jsonLd} />
      <div className="container-page pt-6 pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/products?category=${product.category?.slug}`} className="hover:text-ink">
            {product.category?.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-ink" aria-current="page">
            {product.name}
          </span>
        </nav>
      </div>

      <div className="container-page grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} name={product.name} activeIndex={imageIndex} onChange={setImageIndex} />
        </div>

        <div className="pb-6">
          <div className="flex flex-wrap gap-2">
            {product.isNewArrival && <span className="rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold tracking-wide text-brand-dark">NEW ARRIVAL</span>}
            {product.isBestSeller && <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold tracking-wide">BESTSELLER</span>}
          </div>
          <h1 className="display mt-4 text-4xl sm:text-5xl">{product.name}</h1>
          <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm">
            <RatingStars rating={product.rating} size={15} showValue />
            <span className="text-muted underline-offset-4 hover:underline">{product.reviewCount ? `${product.reviewCount} reviews` : 'No reviews yet'}</span>
          </a>
          <PriceDisplay price={product.price} mrp={product.mrp} size="xl" className="mt-6" showSave />
          <p className="mt-6 text-[16px] leading-7 text-muted">{product.shortDescription}</p>

          <div className="mt-8 space-y-6">
            <ColorSelector colors={product.colors} value={color} onChange={chooseColor} />
            <SizeSelector sizes={product.sizes} value={size} onChange={setSize} />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <StockBadge product={product} />
            {product.capacity && <span className="text-sm text-muted">{product.capacity}</span>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, Math.min(20, product.stock))} disabled={outOfStock} />
            <Button
              size="lg"
              className="min-w-[200px] flex-1"
              loading={add.isPending}
              disabled={outOfStock}
              onClick={() => addToCart()}
              leftIcon={justAdded ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
            >
              {outOfStock ? 'Out of stock' : justAdded ? 'Added to cart' : 'Add to cart'}
            </Button>
            <WishlistButton product={product} size="lg" />
          </div>
          {!outOfStock && (
            <Button size="lg" variant="brand" fullWidth className="mt-3" onClick={buyNow} disabled={add.isPending} leftIcon={<Zap className="h-5 w-5" />}>
              Buy now
            </Button>
          )}

          <ul className="mt-8 grid grid-cols-3 gap-2 text-center">
            {[
              [Truck, 'Free shipping', 'above ₹999'],
              [RotateCcw, '7-day returns', 'no questions'],
              [ShieldCheck, '1-year warranty', 'on every vessel'],
            ].map(([Icon, t, s]) => (
              <li key={t} className="rounded-2xl bg-sand px-2 py-4">
                <Icon className="mx-auto h-5 w-5 text-brand" />
                <p className="mt-2 text-[13px] font-bold">{t}</p>
                <p className="text-[11px] text-muted">{s}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Accordion items={details} />
          </div>
        </div>
      </div>

      <div className="container-page mt-24">
        <Reveal>
          <ReviewSection product={product} distribution={data.ratingDistribution} />
        </Reveal>
      </div>

      {data.related?.length > 0 && (
        <section className="container-page mt-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="display text-3xl sm:text-4xl">You may also like</h2>
            <Link to={`/products?category=${product.category?.slug}`} className="text-sm font-semibold underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {data.related.slice(0, 4).map((p) => (
              <div key={p._id} className={cn('w-[70%] shrink-0 snap-start sm:w-auto')}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed currentId={product._id} />

      {/* Mobile sticky add-to-cart */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{product.name}</p>
            <PriceDisplay price={product.price} mrp={product.mrp} size="sm" />
          </div>
          <Button onClick={() => addToCart()} loading={add.isPending} disabled={outOfStock} leftIcon={<ShoppingBag className="h-4 w-4" />}>
            {outOfStock ? 'Sold out' : 'Add'}
          </Button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />
    </PageTransition>
  );
}
