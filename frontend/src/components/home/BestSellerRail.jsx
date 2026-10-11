import { useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import { ArrowLeft, ArrowRight, Flame, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import ProductCard, { ProductCardSkeleton } from '@/components/product/ProductCard';
import { CountUp, SplitReveal } from '@/components/ui/Effects';
import { Reveal } from '@/components/ui/Motion';
import { useProducts } from '@/hooks/queries';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];

/** Animated SVG liquid surface used as the section's top edge. */
function LiquidEdge() {
  const reduce = useReducedMotion();
  const wave = (amp, phase) => {
    const pts = [];
    for (let x = 0; x <= 2880; x += 60) pts.push(`${x},${40 + Math.sin((x / 1440) * Math.PI * 4 + phase) * amp}`);
    return `M0,80 L${pts.join(' L')} L2880,80 Z`;
  };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-[39px] h-10 overflow-hidden">
      {[
        { d: wave(10, 0), cls: 'fill-[#e6e0f6]', dur: 18 },
        { d: wave(7, 1.6), cls: 'fill-[#efebfb]', dur: 12 },
      ].map((w, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 2880 80"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-full w-[200%]"
          animate={reduce ? undefined : { x: ['0%', '-50%'] }}
          transition={{ duration: w.dur, repeat: Infinity, ease: 'linear' }}
        >
          <path d={w.d} className={w.cls} />
        </motion.svg>
      ))}
    </div>
  );
}

/** Bubbles drifting up through the section. */
function Bubbles() {
  const bubbles = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ left: (i * 37) % 100, size: 6 + ((i * 13) % 18), delay: (i * 1.3) % 9, dur: 9 + ((i * 7) % 8) })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-[-40px] animate-[rise_var(--d)_linear_infinite] rounded-full border border-brand/25 bg-white/40 motion-reduce:hidden"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDelay: `${b.delay}s`, '--d': `${b.dur}s` }}
        />
      ))}
    </div>
  );
}

/** Popularity bar that fills like liquid when it scrolls into view. */
function RefillMeter({ value, max, rank }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const pct = Math.max(12, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div ref={ref} className="mt-4 px-1">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
        <span className="inline-flex items-center gap-1">
          {rank === 0 ? <Flame className="h-3.5 w-3.5 text-[#e2557a]" /> : <TrendingUp className="h-3.5 w-3.5 text-brand" />}
          {formatNumber(value)} sold
        </span>
        <span className="tabular-nums text-ink">{pct}%</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
        <motion.div
          className="liquid-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand via-brand-tint to-[#e2557a]"
          initial={{ width: 0 }}
          animate={{ width: inView ? `${pct}%` : 0 }}
          transition={{ duration: 1.6, delay: 0.15, ease: EASE }}
        />
      </div>
    </div>
  );
}

function RankedCard({ product, rank, max }) {
  return (
    <div className="relative pt-10">
      <span aria-hidden className="display text-outline pointer-events-none absolute -top-2 -left-1 z-0 text-[88px] leading-none transition-colors duration-500 select-none group-hover/slide:[-webkit-text-stroke-color:var(--color-brand)]">
        {String(rank + 1).padStart(2, '0')}
      </span>
      {rank < 3 && (
        <span className="absolute top-3 right-2 z-20 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase shadow-soft">
          {['Most refilled', 'Runner-up', 'Top 3'][rank]}
        </span>
      )}
      <div className="relative z-10">
        <ProductCard product={product} />
        <RefillMeter value={product.soldCount || 0} max={max} rank={rank} />
      </div>
    </div>
  );
}

export default function BestSellerRail() {
  const { data, isLoading } = useProducts({ bestSeller: true, sort: 'popularity', limit: 10 });
  const items = useMemo(() => data?.items || [], [data]);
  const max = items.reduce((m, p) => Math.max(m, p.soldCount || 0), 0);
  const total = items.reduce((s, p) => s + (p.soldCount || 0), 0);
  const swiperRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });

  const sync = (s) => {
    setProgress(Math.min(1, Math.max(0, s.progress)));
    setEdges({ start: s.isBeginning, end: s.isEnd });
  };

  return (
    <section className="relative mt-10 overflow-x-clip bg-gradient-to-b from-brand-soft via-[#f6f2fb] to-sand py-20 lg:py-28" aria-labelledby="bestsellers-h">
      <LiquidEdge />
      <Bubbles />
      <div aria-hidden className="grain absolute inset-0" />

      <div className="container-page relative">
        <div className="mb-12 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow inline-flex items-center gap-3">
                <span className="h-px w-8 bg-ink/30" /> Best sellers
              </p>
            </Reveal>
            <h2 id="bestsellers-h" className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">
              <SplitReveal text="The ones everyone" /> <SplitReveal text="refills." delay={0.25} className="serif-accent text-brand pr-2" />
            </h2>
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted">Ranked by what actually leaves our Bengaluru warehouse. These are the bottles people come back for — then buy a second one for someone else.</p>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="flex flex-wrap items-end gap-6 lg:flex-col lg:items-end">
            {total > 0 && (
              <div className="rounded-2xl border border-white/70 bg-white/60 px-5 py-3 shadow-soft backdrop-blur">
                <p className="text-3xl font-extrabold tracking-tight">
                  <CountUp to={total} suffix="+" />
                </p>
                <p className="text-xs text-muted">bottles sold from this shelf</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {[
                { icon: ArrowLeft, label: 'Previous', fn: () => swiperRef.current?.slidePrev(), disabled: edges.start },
                { icon: ArrowRight, label: 'Next', fn: () => swiperRef.current?.slideNext(), disabled: edges.end },
              ].map(({ icon: Icon, label, fn, disabled }) => (
                <motion.button
                  key={label}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={fn}
                  disabled={disabled}
                  aria-label={`${label} best sellers`}
                  className="grid h-12 w-12 place-items-center rounded-full border border-ink/15 bg-white/70 text-ink backdrop-blur transition hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-35"
                >
                  <Icon className="h-5 w-5" />
                </motion.button>
              ))}
              <Button to="/products?sort=popularity&bestSeller=true" variant="primary" className="ml-2" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Shop all
              </Button>
            </div>
          </Reveal>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <Swiper
              modules={[FreeMode, A11y, Mousewheel]}
              spaceBetween={24}
              slidesPerView={1.35}
              freeMode={{ enabled: true, sticky: false, momentumRatio: 0.6 }}
              mousewheel={{ forceToAxis: true }}
              breakpoints={{ 640: { slidesPerView: 2.3 }, 1024: { slidesPerView: 3.3 }, 1280: { slidesPerView: 4.15 } }}
              className="!overflow-visible"
              a11y={{ enabled: true }}
              onSwiper={(s) => {
                swiperRef.current = s;
                sync(s);
              }}
              onProgress={sync}
              onResize={sync}
            >
              {items.map((p, i) => (
                <SwiperSlide key={p._id} className="group/slide">
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.7, delay: Math.min(i, 4) * 0.08, ease: EASE }}
                  >
                    <RankedCard product={p} rank={i} max={max} />
                  </motion.div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Scroll progress */}
            <div className="mt-12 flex items-center gap-4">
              <span className="text-xs font-bold tabular-nums">01</span>
              <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-ink" animate={{ width: `${Math.max(8, progress * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} />
              </div>
              <span className={cn('text-xs font-bold tabular-nums', 'text-muted')}>{String(items.length).padStart(2, '0')}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
