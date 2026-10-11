import { useRef } from 'react';
import { motion, useScroll, useTransform, useInView, animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Leaf, Recycle, ShieldCheck, Target, Eye, Sparkles, ArrowRight, Award } from 'lucide-react';
import { Reveal, Stagger, StaggerItem, PageTransition } from '@/components/ui/Motion';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { LIFESTYLE } from '@/utils/constants';
import { usePageContent } from '@/hooks/queries';
import { CONTENT_DEFAULTS } from '@/utils/contentDefaults';

/** Splits a stat like "50,000+" into a countable number and a suffix. */
const parseStat = (value) => {
  const m = String(value).match(/^([\d.,]+)(.*)$/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? { n, suffix: m[2], decimals: m[1].includes('.') ? m[1].split('.')[1].length : 0 } : null;
};

function Counter({ to, suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) return setValue(to);
    const controls = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, to, reduce]);
  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export default function About() {
  const { data } = usePageContent('about');
  const c = data || CONTENT_DEFAULTS.about;
  const words = c.headline.split(' ');
  const split = Math.max(1, words.length - 3);
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  const timeline = [
    ['2021', 'A leaky bottle and a ruined laptop', 'Kavya and Vikram sketch a tumbler that actually seals, on a napkin at a Koramangala café.'],
    ['2022', '140 prototypes later', 'We test lids upside down for 24 hours, drop bottles from desks, and fill them with ice in a Chennai summer.'],
    ['2023', 'The Aurora launches', 'Our first 500 tumblers sell out in nine days — almost entirely through word of mouth.'],
    ['2025', '50,000 sippers and counting', 'Today we ship across India from Bengaluru, with every order dispatched within 24 hours.'],
  ];

  return (
    <PageTransition>
      <Seo title="Our story" description="Sipcraft designs premium tumblers and sippers in Bengaluru. Learn about our mission, materials and quality promise." />
      <section className="container-page pt-14 pb-16 lg:pt-20">
        <Reveal className="max-w-4xl">
          <p className="eyebrow">Our story</p>
          <h1 className="display mt-4 text-5xl sm:text-7xl">
            {words.slice(0, split).join(' ')} <span className="serif-accent text-brand">{words.slice(split).join(' ')}</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 whitespace-pre-line text-muted">{c.story}</p>
        </Reveal>
      </section>

      <section ref={ref} className="container-page">
        <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-[2.5rem]">
          <motion.img style={{ y }} src={LIFESTYLE.hike} alt="Hikers on a mountain trail carrying water bottles" className="absolute inset-0 h-[116%] w-full object-cover" />
        </div>
      </section>

      <section className="container-page py-20 lg:py-28">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            [Target, 'Our mission', c.mission],
            [Eye, 'Our vision', c.vision],
          ].filter(([, , d]) => d).map(([Icon, t, d], i) => (
            <Reveal key={t} delay={i * 0.1}>
              <div className="card h-full p-8 sm:p-10">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-6 text-2xl font-bold tracking-tight">{t}</h2>
                <p className="mt-3 text-[16px] leading-8 text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-sand py-20 lg:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="eyebrow">Why we started</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              From napkin sketch to <span className="serif-accent text-brand">50,000 homes.</span>
            </h2>
          </Reveal>
          <ol className="relative space-y-10 border-l border-line-strong pl-8">
            {timeline.map(([year, title, text], i) => (
              <Reveal as="li" key={year} delay={i * 0.08} className="relative">
                <span className="absolute top-1 -left-[41px] grid h-5 w-5 place-items-center rounded-full bg-ink ring-4 ring-sand" aria-hidden />
                <p className="text-sm font-bold text-brand">{year}</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-2 max-w-lg leading-7 text-muted">{text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-20 lg:py-28">
        <Reveal className="mb-12 max-w-2xl">
          <p className="eyebrow">Sustainability & quality</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">
            Built to be kept, <span className="serif-accent text-brand">not replaced.</span>
          </h2>
        </Reveal>
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Recycle, 'Sustainability', c.sustainability],
            [ShieldCheck, 'Our quality promise', c.qualityPromise],
            [Leaf, 'One bottle, 1,000 refills', 'A single Sipcraft replaces an estimated 1,000 single-use bottles over its lifetime.'],
            [Award, '1-year warranty', 'If it fails on our watch, we replace it. No forms, no fuss — just message us.'],
          ].filter(([, , d]) => d).map(([Icon, t, d]) => (
            <StaggerItem key={t}>
              <div className="card h-full p-7">
                <Icon className="h-6 w-6 text-brand" />
                <h3 className="mt-5 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-7 text-muted">{d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-ink py-20 text-white lg:py-24">
        <dl className="container-page grid grid-cols-2 gap-10 text-center lg:grid-cols-4">
          {c.stats.map(({ value, label: l }) => {
            const p = parseStat(value);
            return (
            <Reveal key={l}>
              <dd className="display text-5xl sm:text-6xl">
                {p ? <Counter to={p.n} suffix={p.suffix} decimals={p.decimals} /> : value}
              </dd>
              <dt className="mt-3 text-sm text-white/60">{l}</dt>
            </Reveal>
            );
          })}
        </dl>
      </section>

      <section className="container-page py-20 text-center lg:py-28">
        <Reveal>
          <Sparkles className="mx-auto h-8 w-8 text-brand" />
          <h2 className="display mx-auto mt-6 max-w-3xl text-4xl sm:text-6xl">
            Find the one you’ll <span className="serif-accent text-brand">never leave behind.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button to="/products" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Shop the collection
            </Button>
            <Button to="/team" size="lg" variant="secondary">
              Meet the team
            </Button>
          </div>
        </Reveal>
      </section>
    </PageTransition>
  );
}
