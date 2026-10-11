import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, A11y } from 'swiper/modules';
import 'swiper/css';
import { ArrowRight, ArrowUpRight, Snowflake, Flame, ShieldCheck, Leaf, Truck, RotateCcw, Star, Quote } from 'lucide-react';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { Reveal, Stagger, StaggerItem, PageTransition } from '@/components/ui/Motion';
import { ProductGrid } from '@/components/product/ProductCard';
import { RatingStars } from '@/components/ui/Commerce';
import { Skeleton } from '@/components/ui/Feedback';
import { NewsletterForm } from '@/components/layout/Footer';
import { SocialIcon } from '@/components/layout/Brand';
import FeaturedShowcase from '@/components/home/FeaturedShowcase';
import BestSellerRail from '@/components/home/BestSellerRail';
import { MarqueeBand } from '@/components/ui/Effects';
import { useProducts, useCategories, useBanners, useFeaturedReviews, usePageContent, useSettings } from '@/hooks/queries';
import { LIFESTYLE } from '@/utils/constants';
import { CONTENT_DEFAULTS } from '@/utils/contentDefaults';
import { cn } from '@/utils/cn';

function SectionHeader({ eyebrow, title, accent, description, action }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 sm:mb-12 md:flex-row md:items-end">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-3 text-4xl sm:text-5xl">
          {title} {accent && <span className="serif-accent text-brand">{accent}</span>}
        </h2>
        {description && <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted">{description}</p>}
      </Reveal>
      {action && <Reveal delay={0.1}>{action}</Reveal>}
    </div>
  );
}

function Hero({ content }) {
  const hero = content?.hero || {};
  const stats = content?.stats || [];
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -4]);
  const words = (hero.title || 'Hydrate in').split(' ').filter(Boolean);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[620px] w-[620px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(185,168,232,0.55),transparent_65%)] blur-2xl" />
      <div aria-hidden className="aurora-blob bottom-0 left-[-12%] h-[360px] w-[360px] animate-aurora-alt bg-[#f3c8d6]/70" />
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div className="container-page grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-14 lg:pb-24">
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pr-4 pl-1.5 text-[13px] font-semibold backdrop-blur">
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] text-white">New</span> {hero.badge}
          </motion.div>
          <h1 className="display mt-7 text-[56px] sm:text-[84px] lg:text-[100px]">
            {words.map((w, i) => (
              <motion.span key={`${w}-${i}`} className="mr-[0.22em] inline-block" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
                {w}
              </motion.span>
            ))}
            <motion.span className="serif-accent inline-block text-brand" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
              {hero.accent}
            </motion.span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-6 max-w-md text-lg leading-8 text-muted">
            {hero.subtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-9 flex flex-wrap gap-3">
            <Button to="/products" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              {hero.primaryCta || 'Shop Collection'}
            </Button>
            {hero.secondaryCta && (
              <Button to="/products?sort=popularity&bestSeller=true" size="lg" variant="secondary">
                {hero.secondaryCta}
              </Button>
            )}
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-12 flex gap-8 sm:gap-12">
            {stats.map(({ value: v, label: l }) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="text-2xl font-extrabold tracking-tight sm:text-3xl">{v}</dd>
                <dd className="mt-0.5 text-[13px] text-muted">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div style={{ y }} className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ rotate }}
            className="relative mx-auto aspect-[4/5] max-w-[520px] overflow-hidden rounded-[2.5rem] bg-sand shadow-lift"
          >
            <img src={hero.image || '/media/hero/hero-trio.webp'} alt="Sipcraft tumblers and sippers" className="h-full w-full object-cover" fetchPriority="high" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="absolute top-[18%] left-0 hidden animate-float items-center gap-3 rounded-2xl border border-white/60 bg-white/75 p-3 pr-5 shadow-lift backdrop-blur-xl sm:flex lg:-left-6"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info">
              <Snowflake className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">Cold for 24 hours</span>
              <span className="text-xs text-muted">Double-wall vacuum</span>
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="absolute right-0 bottom-[14%] hidden animate-float-slow rounded-2xl border border-white/60 bg-white/75 p-4 shadow-lift backdrop-blur-xl sm:block lg:-right-4"
          >
            <div className="flex -space-x-2">
              {['#B9A8E8', '#2B2D3A', '#9DB8A0', '#EBB8B8'].map((c) => (
                <span key={c} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: c }} />
              ))}
            </div>
            <p className="mt-2 text-sm font-bold">Aurora · 4 shades</p>
            <p className="text-xs text-muted">Our #1 bestseller</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    [Truck, 'Free shipping above ₹999'],
    [RotateCcw, '7-day easy returns'],
    [ShieldCheck, '1-year warranty'],
    [Leaf, 'BPA-free & plastic-light'],
    [Snowflake, 'Ice-cold for 24 hours'],
    [Flame, 'Hot for 12 hours'],
  ];
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink py-4 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent" />
      <ul className="flex w-max animate-marquee items-center gap-12 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[0, 1].map((k) =>
          row.map(([Icon, label], i) => (
            <li key={`${k}-${i}`} aria-hidden={k === 1 || i >= items.length} className="flex items-center gap-3 text-[13px] font-semibold whitespace-nowrap text-white/85">
              <Icon className="h-4 w-4 text-brand-tint" aria-hidden /> {label}
              <span className="ml-9 text-brand-tint/60">✦</span>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

function Categories() {
  const { data, isLoading } = useCategories();
  const cats = data || [];
  return (
    <section className="container-page py-20 lg:py-28" aria-labelledby="cat-h">
      <SectionHeader eyebrow="Shop by category" title="Find your" accent="everyday carry." />
      <Stagger className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-[1.75rem]" />)
          : cats.map((c) => (
              <StaggerItem key={c._id}>
                <Link to={`/products?category=${c.slug}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-sand">
                    <img src={c.image?.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <span className="absolute right-3 bottom-3 grid h-9 w-9 translate-y-2 place-items-center rounded-full bg-surface opacity-0 shadow-soft transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold tracking-tight">{c.name}</h3>
                  <p className="text-[13px] text-muted">{c.productCount} products</p>
                </Link>
              </StaggerItem>
            ))}
      </Stagger>
    </section>
  );
}

function NewArrivals() {
  const { data, isLoading } = useProducts({ newArrival: true, limit: 4, sort: 'newest' });
  if (!isLoading && !data?.items?.length) return null;
  return (
    <section className="container-page py-20 lg:py-28">
      <SectionHeader
        eyebrow="New arrivals"
        title="Fresh off the"
        accent="line."
        action={
          <Button to="/products?newArrival=true&sort=newest" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Shop new arrivals
          </Button>
        }
      />
      <ProductGrid products={data?.items || []} loading={isLoading} skeletonCount={4} />
    </section>
  );
}

function WhyUs() {
  const features = [
    { icon: Snowflake, title: '24h cold, 12h hot', text: 'Copper-lined double-wall vacuum insulation keeps temperature where you want it.' },
    { icon: ShieldCheck, title: 'Leak-proof, really', text: 'Every lid is tested upside down for 24 hours before it ships. No soggy bags.' },
    { icon: Leaf, title: 'Safe, clean materials', text: '18/8 food-grade steel, BPA-free lids and no metallic aftertaste — ever.' },
    { icon: Flame, title: 'Built for years', text: 'Chip-resistant powder coat and a 1-year warranty on every vessel.' },
  ];
  return (
    <section className="container-page py-20 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <SectionHeader eyebrow="Why Sipcraft" title="Obsessive about" accent="the details." description="We spent two years and 140 prototypes getting the weight, the grip and the seal just right. You’ll feel it in the first sip." />
          <Reveal>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem]">
              <img src={LIFESTYLE.pastel} alt="Pastel insulated bottles arranged on a table" loading="lazy" className="h-full w-full object-cover" />
            </div>
          </Reveal>
        </div>
        <Stagger className="grid content-center gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <StaggerItem key={title}>
              <div className="card h-full p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-muted">{text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Lifestyle() {
  return (
    <section className="container-page pb-20 lg:pb-28">
      <div className="grid gap-4 md:grid-cols-12 md:grid-rows-2">
        <Reveal className="relative overflow-hidden rounded-[2rem] md:col-span-7 md:row-span-2">
          <img src={LIFESTYLE.hike} alt="Hikers on a mountain trail" loading="lazy" className="h-full min-h-[420px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white sm:p-10">
            <p className="text-[11px] font-bold tracking-[0.22em] text-white/70 uppercase">On the trail</p>
            <h3 className="display mt-3 max-w-md text-4xl sm:text-5xl">
              Go further. <span className="serif-accent">Stay cold.</span>
            </h3>
            <Button to="/products?category=water-bottles" variant="light" className="mt-6" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Shop outdoor bottles
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="relative overflow-hidden rounded-[2rem] md:col-span-5">
          <img src={LIFESTYLE.gym} alt="Athlete training with weights" loading="lazy" className="h-full min-h-[260px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
          <Link to="/products?category=sippers" className="absolute bottom-6 left-6 flex items-center gap-2 text-lg font-bold text-white">
            Gym-ready sippers <ArrowUpRight className="h-5 w-5" />
          </Link>
        </Reveal>
        <Reveal delay={0.2} className="relative overflow-hidden rounded-[2rem] md:col-span-5">
          <img src={LIFESTYLE.coffee} alt="Friends toasting with coffee cups" loading="lazy" className="h-full min-h-[260px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
          <Link to="/products?category=travel-mugs" className="absolute bottom-6 left-6 flex items-center gap-2 text-lg font-bold text-white">
            Coffee, on the move <ArrowUpRight className="h-5 w-5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function PromoBanner() {
  const { data } = useBanners('promo');
  const banners = data || [];
  if (!banners.length) return null;
  const themes = { dark: 'bg-ink text-white', accent: 'bg-brand text-white', light: 'bg-brand-soft text-ink' };
  return (
    <section className="container-page pb-20 lg:pb-28" aria-label="Promotions">
      <div className={cn('grid gap-4', banners.length > 1 && 'lg:grid-cols-2')}>
        {banners.slice(0, 2).map((b, i) => (
          <Reveal key={b._id} delay={i * 0.1}>
            <div className={cn('relative flex min-h-[340px] overflow-hidden rounded-[2rem]', themes[b.theme] || themes.dark)}>
              {b.image?.url && <img src={b.image.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
              <div className={cn('absolute inset-0', b.theme === 'light' ? 'bg-gradient-to-r from-brand-soft via-brand-soft/80 to-transparent' : 'bg-gradient-to-r from-black/70 via-black/30 to-transparent')} />
              <div className="relative flex max-w-md flex-col justify-end p-8 sm:p-10">
                {b.eyebrow && <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase backdrop-blur">{b.eyebrow}</span>}
                <h3 className="display mt-4 text-4xl">{b.title}</h3>
                {b.subtitle && <p className="mt-3 text-[15px] leading-7 opacity-80">{b.subtitle}</p>}
                {b.ctaLink && (
                  <Button to={b.ctaLink.startsWith('/') ? b.ctaLink : undefined} href={b.ctaLink.startsWith('http') ? b.ctaLink : undefined} variant={b.theme === 'light' ? 'primary' : 'light'} className="mt-6 w-fit" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    {b.ctaText || 'Shop now'}
                  </Button>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  const { data, isLoading } = useFeaturedReviews();
  const reviews = data || [];
  if (!isLoading && !reviews.length) return null;
  return (
    <section className="bg-ink py-20 text-white lg:py-28">
      <div className="container-page">
        <Reveal className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">Reviews</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              Loved by <span className="serif-accent text-brand-tint">50,000+</span> sippers
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex text-[#F2B33D]">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-5 w-5" fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <span className="text-sm text-white/70">4.8 average from verified buyers</span>
          </div>
        </Reveal>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 rounded-3xl bg-white/5" />
            ))}
          </div>
        ) : (
          <Swiper modules={[A11y, Autoplay]} spaceBetween={16} slidesPerView={1.1} autoplay={{ delay: 5000, disableOnInteraction: true }} breakpoints={{ 768: { slidesPerView: 2.2 }, 1100: { slidesPerView: 3 } }}>
            {reviews.map((r) => (
              <SwiperSlide key={r._id} className="!h-auto">
                <figure className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-7">
                  <Quote className="h-6 w-6 text-brand-tint" aria-hidden />
                  <RatingStars rating={r.rating} size={14} className="mt-4" />
                  <blockquote className="mt-4 flex-1">
                    <p className="font-bold">{r.title}</p>
                    <p className="mt-2 text-[15px] leading-7 text-white/70">{r.comment}</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                    {r.product?.image && <img src={r.product.image} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" />}
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{r.user?.name}</p>
                      <Link to={`/products/${r.product?.slug}`} className="truncate text-white/50 hover:text-white">
                        {r.product?.name}
                      </Link>
                    </div>
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide whitespace-nowrap text-white/70">Verified</span>
                  </figcaption>
                </figure>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>
    </section>
  );
}

function SocialGallery() {
  const shots = [
    { src: LIFESTYLE.sage, alt: 'Sage bottle on a white table' },
    { src: '/media/products/aurora-stainless-steel-tumbler-4.webp', alt: 'Aurora tumblers in lavender and midnight' },
    { src: LIFESTYLE.yoga, alt: 'Morning yoga at sunrise' },
    { src: '/media/products/summit-trail-bottle-3.webp', alt: 'Summit trail bottles' },
    { src: LIFESTYLE.wood, alt: 'Wood-finish bottle' },
    { src: '/media/products/luna-matte-tumbler-2.webp', alt: 'Luna tumbler in lilac' },
  ];
  return (
    <section className="container-page py-20 lg:py-28">
      <SectionHeader
        eyebrow="@sipcraft.in"
        title="Spotted in the"
        accent="wild."
        description="Tag #SipcraftDaily to be featured. Every month we send a free tumbler to our favourite shot."
        action={
          <Button href="https://www.instagram.com/" target="_blank" rel="noreferrer" variant="secondary" leftIcon={<SocialIcon name="instagram" />}>
            Follow us
          </Button>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {shots.map((s, i) => (
          <StaggerItem key={s.src}>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className={cn('group relative block overflow-hidden rounded-3xl', i % 2 ? 'aspect-square lg:mt-10' : 'aspect-square')} aria-label={`${s.alt} — view on Instagram`}>
              <img src={s.src} alt={s.alt} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              <span className="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition duration-300 group-hover:bg-ink/35 group-hover:opacity-100">
                <SocialIcon name="instagram" className="h-6 w-6" />
              </span>
            </a>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Newsletter({ content }) {
  const n = content?.newsletter || {};
  return (
    <section className="container-page">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-soft px-6 py-16 text-center sm:px-12 lg:py-20">
          <div aria-hidden className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-tint/50 blur-3xl" />
          <div aria-hidden className="absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-[#f3c8d6]/60 blur-3xl" />
          <div className="relative mx-auto max-w-xl">
            <p className="eyebrow">Newsletter</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              {n.title} <span className="serif-accent text-brand">{n.accent}</span>
            </h2>
            <p className="mt-4 text-muted">{n.subtitle}</p>
            <NewsletterForm dark={false} className="mx-auto mt-8 max-w-md" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  const { data } = usePageContent('home');
  const content = data || CONTENT_DEFAULTS.home;
  const { data: settings } = useSettings();
  const on = (k) => content?.sections?.[k] !== false;
  return (
    <PageTransition>
      <Seo
        description="Shop premium insulated tumblers, sippers and bottles. Ice-cold for 24 hours, leak-proof, and designed in Bengaluru. Free shipping above ₹999."
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'Sipcraft', url: window.location.origin, logo: `${window.location.origin}/favicon.svg` }}
      />
      <Hero content={content} />
      <TrustStrip />
      {on('featured') && <FeaturedShowcase />}
      {on('bestSellers') && <BestSellerRail />}
      <MarqueeBand items={['Ice-cold 24h', 'Leak-proof', 'Built to last', 'Designed in Bengaluru']} className="border-b border-line bg-canvas" />
      {on('newArrivals') && <NewArrivals />}
      {on('categories') && <Categories />}
      {on('whyUs') && <WhyUs />}
      {on('lifestyle') && <Lifestyle />}
      {on('promo') && <PromoBanner />}
      {on('testimonials') && <Reviews />}
      {on('gallery') && <SocialGallery />}
      {on('newsletter') && settings?.newsletterEnabled !== false && <Newsletter content={content} />}
    </PageTransition>
  );
}
