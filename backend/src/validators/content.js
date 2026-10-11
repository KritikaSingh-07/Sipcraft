/* Schemas + defaults for admin-editable page content. */
const { z } = require('./common');

const text = (max) => z.string().trim().max(max);
const imageUrl = z.union([z.literal(''), z.string().trim().max(1000).regex(/^(https:\/\/|\/(?!\/))/, 'Must be https:// or a site path')]);
const stat = z.object({ value: text(20).min(1), label: text(60).min(1) });
const SERVICE_ICONS = ['palette', 'building', 'boxes', 'pen', 'calendar', 'gift', 'truck', 'headphones', 'sparkles', 'leaf'];

const home = z.object({
  hero: z.object({
    badge: text(80),
    title: text(60).min(1),
    accent: text(40),
    subtitle: text(240),
    primaryCta: text(40).min(1),
    secondaryCta: text(40),
    image: imageUrl,
  }),
  stats: z.array(stat).max(4),
  sections: z.object({
    featured: z.boolean(),
    bestSellers: z.boolean(),
    newArrivals: z.boolean(),
    categories: z.boolean(),
    whyUs: z.boolean(),
    lifestyle: z.boolean(),
    promo: z.boolean(),
    testimonials: z.boolean(),
    gallery: z.boolean(),
    newsletter: z.boolean(),
  }),
  newsletter: z.object({ title: text(80), accent: text(40), subtitle: text(240) }),
});

const about = z.object({
  headline: text(160).min(1),
  story: text(1500).min(1),
  mission: text(600),
  vision: text(600),
  sustainability: text(800),
  qualityPromise: text(800),
  stats: z.array(stat).max(4),
});

const services = z.object({
  headline: text(120).min(1),
  intro: text(400),
  items: z
    .array(z.object({ icon: z.enum(SERVICE_ICONS), title: text(60).min(1), text: text(300).min(1), featured: z.boolean().default(false) }))
    .min(1)
    .max(12),
});

const DEFAULTS = {
  home: {
    hero: {
      badge: 'The Monsoon Edit is here',
      title: 'Hydrate in',
      accent: 'style.',
      subtitle: 'Premium tumblers and sippers designed for everyday adventures — ice-cold for 24 hours, beautiful for years.',
      primaryCta: 'Shop Collection',
      secondaryCta: 'Explore Best Sellers',
      image: '/media/hero/hero-trio.webp',
    },
    stats: [
      { value: '24h', label: 'Ice-cold' },
      { value: '50k+', label: 'Happy sippers' },
      { value: '4.8★', label: 'Average rating' },
    ],
    sections: { featured: true, bestSellers: true, newArrivals: true, categories: true, whyUs: true, lifestyle: true, promo: true, testimonials: true, gallery: true, newsletter: true },
    newsletter: { title: 'Get', accent: '10% off your first order', subtitle: 'Early access to new colours, limited drops and member-only offers. No spam, unsubscribe anytime.' },
  },
  about: {
    headline: 'We make the bottle you’ll actually carry every day.',
    story:
      'Sipcraft started with a simple frustration: beautiful bottles leaked, and leak-proof bottles were ugly. So we spent two years designing vessels that do both — quietly brilliant, built to last, and a joy to hold.',
    mission: 'Make reusable hydration so good-looking and so reliable that single-use plastic simply stops making sense.',
    vision: 'A future where every desk, gym bag and car cup holder in India holds a vessel that lasts a decade, not a week.',
    sustainability: 'Every box is recycled board printed with soy inks — no foam, no plastic wrap. A single Sipcraft replaces an estimated 1,000 single-use bottles over its lifetime.',
    qualityPromise: 'Every lid is leak-tested and every batch pressure-checked before it leaves Bengaluru. If it fails on our watch within a year, we replace it.',
    stats: [
      { value: '50,000+', label: 'Happy customers' },
      { value: '1.2M', label: 'Plastic bottles avoided' },
      { value: '4.8★', label: 'Average rating' },
      { value: '24h', label: 'Dispatch promise' },
    ],
  },
  services: {
    headline: 'More than a bottle shop.',
    intro: 'From a single engraved sipper to 5,000 branded tumblers for your next offsite — we design, personalise and deliver.',
    items: [
      { icon: 'palette', title: 'Custom tumblers', text: 'Your colours, your finish. Choose from 30+ powder coats or match a Pantone for runs of 100+.', featured: false },
      { icon: 'building', title: 'Corporate gifting', text: 'Welcome kits, milestone gifts and client hampers with logo engraving and personalised notes.', featured: true },
      { icon: 'boxes', title: 'Bulk orders', text: 'Tiered pricing from 25 units, dedicated account manager and GST invoicing for businesses.', featured: false },
      { icon: 'pen', title: 'Personalised sippers', text: 'Laser-engraved names, initials or short messages — perfect for kids, teams and weddings.', featured: false },
      { icon: 'calendar', title: 'Event merchandise', text: 'Marathons, conferences and festivals: co-branded bottles delivered to your venue on time.', featured: false },
      { icon: 'gift', title: 'Gift packaging', text: 'Keepsake boxes, ribbon wrap and handwritten cards. Add it at checkout for any order.', featured: false },
      { icon: 'truck', title: 'Fast shipping', text: 'Dispatched within 24 hours from Bengaluru. Metro deliveries in 2–4 days, pan-India coverage.', featured: false },
      { icon: 'headphones', title: 'Customer support', text: 'Real people, real answers within one business day — by email, phone or WhatsApp.', featured: false },
    ],
  },
};

module.exports = { contentSchemas: { home, about, services }, CONTENT_DEFAULTS: DEFAULTS, SERVICE_ICONS };
