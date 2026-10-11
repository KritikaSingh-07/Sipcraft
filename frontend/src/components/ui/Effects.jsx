/* Motion & interaction effects. Every effect is disabled or simplified under prefers-reduced-motion. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Thin brand-gradient bar showing how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-brand via-brand-tint to-[#e2557a]" style={{ scaleX }} />;
}

/** Brief progress bar on route changes (lazy pages load behind it). */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [pathname]);
  return (
    <AnimatePresence>
      <motion.div
        key={key}
        aria-hidden
        className="fixed inset-x-0 top-0 z-[61] h-[3px] origin-left bg-ink"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ scaleX: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }, opacity: { delay: 0.55, duration: 0.3 } }}
      />
    </AnimatePresence>
  );
}

export function BackToTop() {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useEffect(() => scrollY.on('change', (v) => setShow(v > 900)), [scrollY]);
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed right-5 bottom-24 z-40 grid h-12 w-12 place-items-center rounded-full bg-ink text-white shadow-lift lg:bottom-8"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** 3D tilt that follows the pointer, with a soft spotlight glare. Pointer devices only. */
export function TiltCard({ children, className, max = 8, glare = true }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 220, damping: 22 });
  const sry = useSpring(ry, { stiffness: 220, damping: 22 });
  const background = useTransform([gx, gy], ([x, y]) => `radial-gradient(420px circle at ${x}% ${y}%, rgba(255,255,255,0.38), transparent 45%)`);
  const [active, setActive] = useState(false);

  const onMove = (e) => {
    if (reduce || !canHover()) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * max * 2);
    rx.set(-(py - 0.5) * max * 2);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    setActive(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      className={cn('relative will-change-transform', className)}
    >
      {children}
      {glare && !reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300" style={{ background, opacity: active ? 1 : 0 }} />}
    </motion.div>
  );
}

/** Pulls its child slightly toward the cursor. */
export function Magnetic({ children, strength = 0.25, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 250, damping: 18 });
  const y = useSpring(0, { stiffness: 250, damping: 18 });
  return (
    <motion.div
      ref={ref}
      className={cn('inline-block', className)}
      style={{ x, y }}
      onMouseMove={(e) => {
        if (reduce || !canHover()) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Cycles through words with a vertical slide. `words` can be an array or a "a|b|c" string. */
export function RotatingWords({ words, interval = 2600, className }) {
  const list = (Array.isArray(words) ? words : String(words || '').split('|')).map((w) => w.trim()).filter(Boolean);
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (list.length < 2 || reduce) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list.length, interval, reduce]);
  if (!list.length) return null;
  return (
    <span className={cn('relative inline-grid overflow-hidden align-bottom', className)}>
      <span className="sr-only">{list.join(', ')}</span>
      {/* Invisible longest word reserves width so the line doesn't jump. */}
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {list.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={list[i]}
          aria-hidden
          className="col-start-1 row-start-1 pb-[0.12em]"
          initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {list[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Reveals a heading word by word as it scrolls into view. */
export function SplitReveal({ text, className, delay = 0, as: Tag = 'span' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const words = String(text || '').split(' ');
  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { y: '110%' }}
            animate={inView ? (reduce ? { opacity: 1 } : { y: '0%' }) : undefined}
            transition={{ duration: 0.8, delay: delay + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Animated number counter, starting when visible. */
export function CountUp({ to, suffix = '', decimals = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setValue(to);
      return undefined;
    }
    const c = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => c.stop();
  }, [inView, to, reduce]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {value.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Large kinetic text band — two rows scrolling in opposite directions. */
export function MarqueeBand({ items, className }) {
  const row = [...items, ...items];
  return (
    <div className={cn('relative overflow-hidden py-8 select-none', className)} aria-hidden>
      {[0, 1].map((r) => (
        <div key={r} className={cn('flex w-max items-center gap-10 whitespace-nowrap motion-reduce:animate-none', r === 0 ? 'animate-marquee' : 'animate-marquee-reverse mt-3')}>
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center gap-10">
              {row.map((t, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-10">
                  <span className={cn('display text-6xl sm:text-8xl', (i + r) % 2 ? 'text-outline' : 'text-ink')}>{t}</span>
                  <span className="text-4xl text-brand sm:text-5xl">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card with a spotlight that follows the pointer and a glowing border on hover. */
export function SpotlightCard({ children, className }) {
  const ref = useRef(null);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const background = useTransform([x, y], ([a, b]) => `radial-gradient(360px circle at ${a}px ${b}px, rgba(109,91,208,0.14), transparent 60%)`);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        x.set(-200);
        y.set(-200);
      }}
      className={cn('group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition duration-500 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift', className)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background }} />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Renders the product image that flies into the cart icon after "Add to cart". */
export function FlyToCartLayer() {
  const item = useUIStore((s) => s.flyItem);
  const clear = useUIStore((s) => s.clearFly);
  const reduce = useReducedMotion();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!item) return;
    if (reduce) {
      clear();
      return;
    }
    const icon = [...document.querySelectorAll('[data-cart-target]')].find((el) => el.offsetParent !== null);
    if (!icon) {
      clear();
      return;
    }
    const r = icon.getBoundingClientRect();
    setTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [item, reduce, clear]);

  if (!item || !target) return null;
  const size = Math.min(item.rect.w, 160);
  const startX = item.rect.x + item.rect.w / 2 - size / 2;
  const startY = item.rect.y + item.rect.h / 2 - size / 2;

  return createPortal(
    <motion.img
      key={item.id}
      src={item.src}
      alt=""
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[90] rounded-2xl object-cover shadow-lift"
      style={{ width: size, height: size }}
      initial={{ x: startX, y: startY, scale: 1, opacity: 1, rotate: 0 }}
      animate={{
        x: [startX, (startX + target.x) / 2, target.x - size / 2],
        y: [startY, Math.min(startY, target.y) - 120, target.y - size / 2],
        scale: [1, 0.7, 0.12],
        rotate: [0, -12, 8],
        opacity: [1, 1, 0.4],
      }}
      transition={{ duration: 0.85, ease: [0.45, 0, 0.2, 1] }}
      onAnimationComplete={() => {
        setTarget(null);
        clear();
      }}
    />,
    document.body,
  );
}
