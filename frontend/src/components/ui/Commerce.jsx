import { Minus, Plus, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

/** Fractional star rating, accessible as a single text value. */
export function RatingStars({ rating = 0, size = 14, className, showValue, count }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative inline-flex" role="img" aria-label={`Rated ${Number(rating).toFixed(1)} out of 5`}>
        <span className="flex text-line-strong">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} aria-hidden />
          ))}
        </span>
        <span className="absolute inset-0 flex overflow-hidden text-[#F2B33D]" style={{ width: `${(Math.min(5, rating) / 5) * 100}%` }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="shrink-0" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} aria-hidden />
          ))}
        </span>
      </span>
      {showValue && <span className="text-[13px] font-semibold text-ink">{Number(rating).toFixed(1)}</span>}
      {count !== undefined && <span className="text-[13px] text-muted">({count})</span>}
    </span>
  );
}

export function PriceDisplay({ price, mrp, size = 'md', className, showSave }) {
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const sizes = { sm: 'text-[15px]', md: 'text-lg', lg: 'text-3xl', xl: 'text-4xl' };
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-bold tracking-tight text-ink', sizes[size])}>{formatPrice(price)}</span>
      {discount > 0 && (
        <>
          <span className={cn('text-muted line-through', size === 'lg' || size === 'xl' ? 'text-lg' : 'text-[13px]')}>
            <span className="sr-only">Original price </span>
            {formatPrice(mrp)}
          </span>
          <span className={cn('font-bold text-success', size === 'lg' || size === 'xl' ? 'text-base' : 'text-[12px]')}>{discount}% off</span>
        </>
      )}
      {showSave && discount > 0 && <span className="w-full text-[13px] text-muted">You save {formatPrice(mrp - price)} · Inclusive of all taxes</span>}
    </div>
  );
}

export function QuantitySelector({ value, onChange, min = 1, max = 20, size = 'md', disabled, label = 'Quantity' }) {
  const h = size === 'sm' ? 'h-9' : 'h-12';
  const btn = cn('grid place-items-center text-ink transition hover:bg-sand disabled:opacity-30', size === 'sm' ? 'w-9' : 'w-11');
  return (
    <div className={cn('inline-flex items-center rounded-full border border-line-strong bg-surface', h)} role="group" aria-label={label}>
      <button type="button" className={cn(btn, 'h-full rounded-l-full')} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn('min-w-8 text-center font-semibold tabular-nums', size === 'sm' ? 'text-sm' : '')} aria-live="polite">
        {value}
      </motion.span>
      <button type="button" className={cn(btn, 'h-full rounded-r-full')} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function StockBadge({ product, className }) {
  const status = product.stockStatus || (product.stock <= 0 ? 'out_of_stock' : product.stock <= (product.lowStockThreshold ?? 5) ? 'low_stock' : 'in_stock');
  const map = {
    in_stock: ['bg-success', 'text-success', 'In stock'],
    low_stock: ['bg-warning', 'text-warning', `Only ${product.stock} left`],
    out_of_stock: ['bg-danger', 'text-danger', 'Out of stock'],
  };
  const [dot, text, label] = map[status];
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-semibold', text, className)}>
      <span className="relative flex h-2 w-2">
        {status !== 'out_of_stock' && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-50', dot)} />}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dot)} />
      </span>
      {label}
    </span>
  );
}
