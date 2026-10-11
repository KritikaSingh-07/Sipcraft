import { Palette, Building2, Boxes, PenTool, CalendarHeart, Gift, Truck, Headphones, ArrowRight, Check, Sparkles, Leaf } from 'lucide-react';
import { usePageContent } from '@/hooks/queries';
import { CONTENT_DEFAULTS } from '@/utils/contentDefaults';
import { Reveal, Stagger, StaggerItem, PageTransition } from '@/components/ui/Motion';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { cn } from '@/utils/cn';

const ICONS = { palette: Palette, building: Building2, boxes: Boxes, pen: PenTool, calendar: CalendarHeart, gift: Gift, truck: Truck, headphones: Headphones, sparkles: Sparkles, leaf: Leaf };
const TONES = ['bg-brand-soft text-brand', 'bg-info-soft text-info', 'bg-success-soft text-success', 'bg-warning-soft text-warning', 'bg-danger-soft text-danger'];


export default function Services() {
  const { data } = usePageContent('services');
  const c = data || CONTENT_DEFAULTS.services;
  const words = c.headline.split(' ');
  const split = Math.max(1, words.length - 2);
  const services = c.items.map((it, i) => ({ ...it, icon: ICONS[it.icon] || Sparkles, tone: TONES[i % TONES.length] }));
  return (
    <PageTransition>
      <Seo title="Services" description="Custom tumblers, corporate gifting, bulk orders, personalised sippers, event merchandise and gift packaging from Sipcraft." />
      <section className="container-page pt-14 pb-16 lg:pt-20">
        <Reveal className="max-w-3xl">
          <p className="eyebrow">Our services</p>
          <h1 className="display mt-4 text-5xl sm:text-7xl">
            {words.slice(0, split).join(' ')} <span className="serif-accent text-brand">{words.slice(split).join(' ')}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">{c.intro}</p>
        </Reveal>
      </section>

      <section className="container-page">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ icon: Icon, title, text, tone, featured }) => (
            <StaggerItem key={title}>
              <article className={cn('group relative h-full overflow-hidden rounded-3xl border p-7 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift', featured ? 'border-ink bg-ink text-white' : 'border-line bg-surface')}>
                {featured && <span className="absolute top-5 right-5 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold tracking-wide">MOST REQUESTED</span>}
                <span className={cn('grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-110', featured ? 'bg-white/10 text-brand-tint' : tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-6 text-lg font-bold tracking-tight">{title}</h2>
                <p className={cn('mt-2 text-[15px] leading-7', featured ? 'text-white/70' : 'text-muted')}>{text}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="container-page py-20 lg:py-28">
        <div className="grid items-center gap-12 overflow-hidden rounded-[2.5rem] bg-sand p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
          <Reveal>
            <p className="eyebrow">How bulk orders work</p>
            <h2 className="display mt-3 text-4xl">Three steps, zero stress.</h2>
            <ol className="mt-8 space-y-6">
              {[
                ['Tell us what you need', 'Quantity, products, colours, branding and your deadline.'],
                ['Approve your mock-up', 'Free digital proof within 48 hours. Revisions included.'],
                ['We produce & deliver', 'Quality-checked, gift-packed and shipped to one or many addresses.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold">{t}</p>
                    <p className="mt-1 text-[15px] text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button to="/contact?subject=Bulk%20order%20enquiry" size="lg" className="mt-10" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Request a quote
            </Button>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <img src="/media/products/the-everyday-duo-gift-set-0.webp" alt="Sipcraft gift set with two tumblers" className="w-full rounded-[2rem] shadow-lift" loading="lazy" />
            <div className="absolute -bottom-4 left-4 rounded-2xl bg-surface p-4 shadow-lift sm:-left-6">
              {['Free logo engraving on 50+', 'GST invoice', 'Pan-India delivery'].map((t) => (
                <p key={t} className="flex items-center gap-2 text-sm font-semibold">
                  <Check className="h-4 w-4 text-success" /> {t}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
}
