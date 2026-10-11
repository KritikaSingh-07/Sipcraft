import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { RatingStars, PriceDisplay, QuantitySelector, StockBadge } from '@/components/ui/Commerce';
import { Skeleton, ErrorState } from '@/components/ui/Feedback';
import { ColorSelector, SizeSelector, ProductGallery } from './ProductOptions';
import { WishlistButton } from './ProductCard';
import { useUIStore } from '@/store/uiStore';
import { useProduct } from '@/hooks/queries';
import { useCartActions } from '@/hooks/useCart';

export default function QuickViewModal() {
  const slug = useUIStore((s) => s.quickViewSlug);
  const close = useUIStore((s) => s.closeQuickView);
  const { data, isLoading, error, refetch } = useProduct(slug);
  const product = data?.product;
  const { add } = useCartActions();
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (product) {
      setColor(product.colors?.[0]?.name || '');
      setSize(product.sizes?.[product.sizes.length - 1] || '');
      setQty(1);
      setImageIndex(0);
    }
  }, [product]);

  const chooseColor = (name) => {
    setColor(name);
    const i = product.colors.findIndex((c) => c.name === name);
    if (i >= 0 && i < product.images.length) setImageIndex(i);
  };

  return (
    <Modal open={Boolean(slug)} onClose={close} size="xl" title={product ? undefined : 'Quick view'}>
      {isLoading || !product ? (
        error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-[4/5] w-full rounded-[2rem]" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <ProductGallery images={product.images} name={product.name} activeIndex={imageIndex} onChange={setImageIndex} />
          <div className="flex flex-col">
            <p className="eyebrow">{product.category?.name}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{product.name}</h2>
            {product.reviewCount > 0 && <RatingStars rating={product.rating} showValue count={product.reviewCount} className="mt-3" />}
            <PriceDisplay price={product.price} mrp={product.mrp} size="lg" className="mt-4" showSave />
            <p className="mt-4 text-[15px] leading-7 text-muted">{product.shortDescription}</p>
            <div className="mt-6 space-y-5">
              <ColorSelector colors={product.colors} value={color} onChange={chooseColor} />
              <SizeSelector sizes={product.sizes} value={size} onChange={setSize} />
              <StockBadge product={product} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, Math.min(20, product.stock))} disabled={product.stock <= 0} />
              <Button
                className="flex-1"
                loading={add.isPending}
                disabled={product.stock <= 0}
                leftIcon={<ShoppingBag className="h-4 w-4" />}
                onClick={() => add.mutate({ product, quantity: qty, color, size }, { onSuccess: close })}
              >
                {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
              </Button>
              <WishlistButton product={product} size="lg" />
            </div>
            <Link to={`/products/${product.slug}`} onClick={close} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
              View full details <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
