import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Snowflake, Droplets, ShieldCheck, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import ProductCard, { ProductCardSkeleton } from '@/components/product/ProductCard';
import { PriceDisplay } from '@/components/ui/Commerce';
import { Skeleton } from '@/components/ui/Feedback';
import { SplitReveal } from '@/components/ui/Effects';
import { Reveal } from '@/components/ui/Motion';
import { useProducts } from '@/hooks/queries';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];

/** Slow rotating circular text badge. */
function OrbitBadge({ text, className }) {
  const chars = `${text} • `.repeat(2);
  return (
    <div aria-hidden className={cn('pointer-events-none relative h-28 w-28', className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full animate-spin-slow motion-reduce:animate-none">
        <defs>
          <path id="orbit-path" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-ink text-[8.5px] font-bold tracking-[0.18em] uppercase">
          <textPath href="#orbit-path">{chars}</textPath>
        </text>
      </svg>
      <span className="absolute inset-0 m-auto grid h-11 w-11 place-items-center rounded-full bg-ink text-white">
        <Sparkles className="h-4 w-4" />
      </span>
    </div>
  );
}

/** Large hero card for the lead featured product — colour swatches swap the render and tint the stage. */
function Spotlight({ product }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const colors = product.colors || [];
  const images = product.images || [];
  const tint = colors[active]?.hex || '#B9A8E8';
  const image = images[Math.min(active, images.length - 1)]?.url;
  const coldHours = (product.features || []).join(' ').match(/cold\s+(\d+)\s*h/i)?.[1];

  return (
    <motion.article
      layout
      className="group relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-[2rem] bg-ink text-white lg:min-h-0"
    >
      {/* Tinted stage that follows the selected colour */}
      <motion.div aria-hidden className="absolute inset-0" animate={{ background: `radial-gradient(120% 80% at 50% 38%, ${tint}66 0%, ${tint}1f 38%, transparent 70%)` }} transition={{ duration: 0.8 }} />
      <div aria-hidden className="grain absolute inset-0" />
      <motion.div
        aria-hidden
        className="absolute top-[18%] left-1/2 h-[46%] w-[70%] -translate-x-1/2 rounded-full blur-3xl"
        animate={{ backgroundColor: tint, scale: reduce ? 1 : [1, 1.08, 1] }}
        transition={{ backgroundColor: { duration: 0.8 }, scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
        style={{ opacity: 0.35 }}
      />

      <div className="relative flex items-start justify-between p-6 sm:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7ee2a8] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7ee2a8]" />
            </span>
            Editor’s pick
          </span>
          <h3 className="display mt-4 max-w-xs text-3xl sm:text-4xl">{product.name}</h3>
          <p className="mt-2 max-w-xs text-sm leading-6 text-white/60">{product.shortDescription}</p>
        </div>
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink transition duration-300 group-hover:rotate-45">
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>

      <Link to={`/products/${product.slug}`} className="relative mx-auto flex w-full flex-1 items-center justify-center px-6" tabIndex={-1} aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={image}
            src={image}
            alt=""
            className="h-full max-h-[360px] w-auto rounded-[1.5rem] object-contain drop-shadow-[0_40px_40px_rgba(0,0,0,0.45)] lg:max-h-[420px]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, rotate: -4, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -10, 0], rotate: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.7, ease: EASE, y: reduce ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
          />
        </AnimatePresence>
      </Link>

      {/* Spec chips */}
      <div className="relative flex flex-wrap gap-2 px-6 sm:px-8">
        {coldHours && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <Snowflake className="h-3.5 w-3.5 text-[#9fd3f5]" /> {coldHours}h cold
          </span>
        )}
        {product.capacity && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <Droplets className="h-3.5 w-3.5 text-brand-tint" /> {product.capacity}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-[#7ee2a8]" /> Leak-tested
        </span>
      </div>

      <div className="relative mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 p-6 sm:px-8">
        <div>
          {colors.length > 0 && (
            <>
              <p className="text-[11px] font-bold tracking-[0.16em] text-white/50 uppercase">
                Colour · <span className="text-white">{colors[active]?.name}</span>
              </p>
              <div className="mt-2.5 flex gap-2" role="radiogroup" aria-label="Preview colour">
                {colors.slice(0, 5).map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={active === i}
                    aria-label={c.name}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    className="relative grid h-8 w-8 place-items-center rounded-full"
                  >
                    {active === i && <motion.span layoutId="spotlight-swatch" className="absolute inset-0 rounded-full ring-2 ring-white" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span className="h-5 w-5 rounded-full ring-1 ring-white/20" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="text-right [&_.text-ink]:text-white [&_.text-muted]:text-white/50">
          <PriceDisplay price={product.price} mrp={product.mrp} size="lg" className="justify-end" />
        </div>
      </div>
    </motion.article>
  );
}

export default function FeaturedShowcase() {
  const { data, isLoading } = useProducts({ featured: true, limit: 16, sort: 'newest' });
  const items = useMemo(() => data?.items || [], [data]);
  const [filter, setFilter] = useState('all');

  const tabs = useMemo(() => {
    const seen = new Map();
    for (const p of items) if (p.category?.slug && !seen.has(p.category.slug)) seen.set(p.category.slug, p.category.name);
    return [['all', 'All'], ...seen.entries()];
  }, [items]);

  const visible = filter === 'all' ? items : items.filter((p) => p.category?.slug === filter);
  const [lead, ...rest] = visible;
  const grid = rest.slice(0, 4);

  return (
    <section className="relative overflow-hidden pt-6 pb-24 lg:pb-32" aria-labelledby="featured-h">
      {/* Decorative backdrop */}
      <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
      <div aria-hidden className="aurora-blob top-10 -left-40 h-[420px] w-[420px] animate-aurora bg-brand-tint" />
      <div aria-hidden className="aurora-blob right-[-12%] bottom-0 h-[380px] w-[380px] animate-aurora-alt bg-[#f3c8d6]" />

      <div className="container-page relative">
        <div className="mb-10 flex flex-col justify-between gap-8 lg:mb-14 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow inline-flex items-center gap-3">
                <span className="h-px w-8 bg-ink/30" /> Featured collection
              </p>
            </Reveal>
            <h2 id="featured-h" className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">
              <SplitReveal text="Made to be" /> <SplitReveal text="carried." delay={0.2} className="serif-accent text-shimmer pr-2" />
            </h2>
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted">Our most-loved silhouettes in seasonal colours. Every one is pressure-tested, food-safe and built to last — pick a shape, then a shade.</p>
            </Reveal>
          </div>
          <div className="flex items-center gap-6">
            <OrbitBadge text="Pressure tested · Food safe · Built to last" className="hidden xl:block" />
            <Button to="/products" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
              View all
            </Button>
          </div>
        </div>

        {/* Category filter with sliding indicator */}
        {tabs.length > 2 && (
          <Reveal delay={0.1}>
            <LayoutGroup id="featured-tabs">
              <div role="tablist" aria-label="Filter featured products" className="scrollbar-none -mx-4 mb-8 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:rounded-full sm:border sm:border-line sm:bg-surface/70 sm:p-1.5 sm:backdrop-blur">
                {tabs.map(([slug, name]) => (
                  <button
                    key={slug}
                    type="button"
                    role="tab"
                    aria-selected={filter === slug}
                    onClick={() => setFilter(slug)}
                    className={cn('relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors', filter === slug ? 'text-white' : 'text-ink-soft hover:text-ink')}
                  >
                    {filter === slug && <motion.span layoutId="featured-pill" className="absolute inset-0 rounded-full bg-ink shadow-soft" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                    <span className="relative">{name}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
          </Reveal>
        )}

        {isLoading ? (
          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <Skeleton className="min-h-[560px] rounded-[2rem]" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          lead && (
            <motion.div layout className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
              <AnimatePresence mode="wait">
                <motion.div key={lead._id} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.5, ease: EASE }}>
                  <Spotlight product={lead} />
                </motion.div>
              </AnimatePresence>
              <motion.div layout className="grid grid-cols-2 content-start gap-x-4 gap-y-8 sm:gap-x-5">
                <AnimatePresence mode="popLayout">
                  {grid.map((p, i) => (
                    <motion.div
                      key={p._id}
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.55, delay: i * 0.06, ease: EASE }}
                    >
                      <ProductCard product={p} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {grid.length === 0 && (
                  <div className="col-span-2 grid min-h-[240px] place-items-center rounded-[1.75rem] border border-dashed border-line-strong text-center text-sm text-muted">
                    <p>
                      More {tabs.find(([s]) => s === filter)?.[1]?.toLowerCase()} coming soon.
                      <br />
                      <Link to="/products" className="link-underline font-semibold text-ink">
                        Browse everything
                      </Link>
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )
        )}
      </div>
    </section>
  );
}
