import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '@/utils/cn';

export function ColorSelector({ colors, value, onChange }) {
  if (!colors?.length) return null;
  return (
    <fieldset>
      <legend className="mb-3 text-sm">
        <span className="font-semibold">Colour:</span> <span className="text-muted">{value || 'Select a colour'}</span>
      </legend>
      <div className="flex flex-wrap gap-2.5" role="radiogroup">
        {colors.map((c) => {
          const active = c.name === value;
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              title={c.name}
              onClick={() => onChange(c.name)}
              className={cn('relative grid h-11 w-11 place-items-center rounded-full transition', active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'hover:scale-105')}
            >
              <span className="h-9 w-9 rounded-full ring-1 ring-black/10 ring-inset" style={{ background: c.hex }} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SizeSelector({ sizes, value, onChange }) {
  if (!sizes?.length) return null;
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">Size</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {sizes.map((s) => {
          const active = s === value;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s)}
              className={cn('relative h-11 rounded-full border px-5 text-sm font-semibold transition', active ? 'border-ink text-white' : 'border-line-strong hover:border-ink')}
            >
              {active && <motion.span layoutId={`size-pill-${sizes.join()}`} className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
              <span className="relative">{s}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Image gallery with animated transitions, thumbnails, swipe and hover zoom. */
export function ProductGallery({ images = [], name, activeIndex, onChange }) {
  const [index, setIndexState] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [direction, setDirection] = useState(1);
  const touch = useRef(null);
  const current = activeIndex ?? index;
  const setIndex = (i) => {
    const next = (i + images.length) % images.length;
    setDirection(next > current ? 1 : -1);
    setIndexState(next);
    onChange?.(next);
  };

  useEffect(() => {
    if (activeIndex !== undefined) setIndexState(activeIndex);
  }, [activeIndex]);

  if (!images.length) return <div className="aspect-[4/5] rounded-[2rem] bg-sand" />;
  const img = images[current] || images[0];

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      <div className="scrollbar-none flex gap-3 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto" role="tablist" aria-label="Product images">
        {images.map((im, i) => (
          <button
            key={im._id || im.url}
            role="tab"
            aria-selected={i === current}
            aria-label={`Show image ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn('relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-sand transition lg:h-24 lg:w-20', i === current ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'opacity-70 hover:opacity-100')}
          >
            <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>

      <div
        className="relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-[2rem] bg-sand"
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) setIndex(current + (dx < 0 ? 1 : -1));
          touch.current = null;
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={img.url}
            src={img.url}
            alt={img.alt || name}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40, scale: 1.02 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transformOrigin: origin }}
            draggable={false}
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 hidden transition-opacity duration-300 lg:block" style={{ opacity: zoom ? 1 : 0 }}>
          <img src={img.url} alt="" className="h-full w-full scale-[1.9] object-cover" style={{ transformOrigin: origin }} aria-hidden />
        </div>
        <span className="pointer-events-none absolute bottom-4 left-4 hidden items-center gap-1.5 rounded-full bg-surface/85 px-3 py-1.5 text-[11px] font-semibold backdrop-blur lg:flex">
          <ZoomIn className="h-3.5 w-3.5" /> Hover to zoom
        </span>
        {images.length > 1 && (
          <>
            <button onClick={() => setIndex(current - 1)} className="absolute top-1/2 left-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface/85 shadow-soft backdrop-blur lg:hidden" aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setIndex(current + 1)} className="absolute top-1/2 right-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface/85 shadow-soft backdrop-blur lg:hidden" aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute right-4 bottom-4 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-bold text-white tabular-nums">
              {current + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
