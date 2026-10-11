import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { PageTransition } from '@/components/ui/Motion';

/** Split-screen auth layout: form on the left, brand imagery on the right (desktop). */
export default function AuthShell({ title, subtitle, children, footer, image = '/media/products/aurora-stainless-steel-tumbler-4.webp' }) {
  return (
    <PageTransition className="container-page py-10 lg:py-14">
      <div className="grid min-h-[640px] overflow-hidden rounded-[2.5rem] border border-line bg-surface shadow-soft lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <h1 className="display text-4xl sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </div>
        </div>
        <div className="relative hidden overflow-hidden bg-sand lg:block">
          <motion.img src={image} alt="" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-8 bottom-8 rounded-3xl border border-white/60 bg-white/70 p-6 backdrop-blur-xl">
            <div className="flex text-[#F2B33D]">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <p className="mt-3 font-semibold leading-7">“The only bottle I’ve owned that survives my gym bag, my commute and my toddler. Ice still clinking at 9 pm.”</p>
            <p className="mt-2 text-sm text-muted">Ananya I. · Bengaluru</p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
