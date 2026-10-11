import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Briefcase, Droplets, Heart, Leaf, Mail, MapPin, Quote, Sparkles, Users, Wrench } from 'lucide-react';
import { useTeam } from '@/hooks/queries';
import { Reveal, Stagger, StaggerItem, PageTransition } from '@/components/ui/Motion';
import { CountUp, MarqueeBand, SplitReveal, SpotlightCard } from '@/components/ui/Effects';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { SocialIcon } from '@/components/layout/Brand';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];

const STATS = [
  { to: 140, suffix: '+', label: 'Prototypes before launch' },
  { to: 50000, suffix: '+', label: 'Happy sippers' },
  { to: 24, suffix: 'h', label: 'Average dispatch time' },
  { to: 6, suffix: '', label: 'Cities we work from' },
];

const VALUES = [
  { icon: Wrench, title: 'Sweat the small stuff', text: 'A lid that clicks just right, a handle that balances a full litre. We test until it feels inevitable.' },
  { icon: Heart, title: 'Customers, not tickets', text: 'Every message gets a real reply within a business day — from someone who actually uses the product.' },
  { icon: Leaf, title: 'Leave less behind', text: 'Plastic-light packaging, a take-back programme and products built to outlast trends.' },
  { icon: Sparkles, title: 'Make it joyful', text: 'Hydration is a habit. We design colours and shapes that make you want to reach for it.' },
];

const MILESTONES = [
  { year: '2022', title: 'One leaky bottle too many', text: 'Kavya and Vikram start sketching in a Koramangala garage after a bottle ruins a laptop.' },
  { year: '2023', title: '140 prototypes later', text: 'The Aurora tumbler launches with 400 pre-orders — and sells out in nine days.' },
  { year: '2024', title: 'A real warehouse', text: 'We move into our Bengaluru fulfilment centre and start shipping within 24 hours.' },
  { year: '2025', title: 'Beyond tumblers', text: 'Sippers, trail bottles and travel mugs join the line-up, plus our bottle take-back programme.' },
  { year: '2026', title: '50,000 sippers', text: 'A team of eight across six cities, and a community that names our next colourways.' },
];

const ROLES = [
  { title: 'Senior Industrial Designer', team: 'Design', place: 'Bengaluru · On-site' },
  { title: 'Growth Marketing Manager', team: 'Brand', place: 'Remote · India' },
  { title: 'Warehouse Operations Associate', team: 'Operations', place: 'Bengaluru · On-site' },
];

/** Floating collage of member portraits in the hero. */
function AvatarCloud({ members }) {
  const reduce = useReducedMotion();
  const spots = [
    'top-[4%] left-[30%] h-36 w-36',
    'top-[30%] left-[2%] h-28 w-28',
    'top-[26%] right-[4%] h-32 w-32',
    'bottom-[6%] left-[16%] h-24 w-24',
    'bottom-[2%] right-[22%] h-28 w-28',
    'top-[52%] left-[40%] h-20 w-20',
  ];
  return (
    <div aria-hidden className="relative mx-auto hidden h-[440px] w-full max-w-[480px] lg:block">
      <div className="absolute inset-[18%] animate-spin-slow rounded-full border border-dashed border-brand/30 motion-reduce:animate-none" />
      <div className="absolute inset-[32%] rounded-full bg-gradient-to-br from-brand-tint/50 to-[#f3c8d6]/50 blur-2xl" />
      {members.slice(0, spots.length).map((m, i) => (
        <motion.div
          key={m._id}
          className={cn('absolute overflow-hidden rounded-full border-4 border-white bg-sand shadow-lift', spots[i])}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, i % 2 ? 10 : -10, 0] }}
          transition={{ opacity: { delay: 0.3 + i * 0.1 }, scale: { delay: 0.3 + i * 0.1, duration: 0.8, ease: EASE }, y: { duration: 5 + i, repeat: Infinity, ease: 'easeInOut' } }}
        >
          {m.image?.url ? <img src={m.image.url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-extrabold text-ink/30">{initials(m.name)}</span>}
        </motion.div>
      ))}
      <motion.div
        className="absolute right-0 bottom-[30%] rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-lift backdrop-blur-xl"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.7 }}
      >
        <p className="text-sm font-bold">We’re hiring ✦</p>
        <p className="text-xs text-muted">{ROLES.length} open roles</p>
      </motion.div>
    </div>
  );
}

function Socials({ m, dark }) {
  const links = [
    ['linkedin', m.socials?.linkedin, 'LinkedIn'],
    ['instagram', m.socials?.instagram, 'Instagram'],
    ['twitter', m.socials?.twitter, 'X'],
  ].filter(([, href]) => href);
  if (!links.length && !m.socials?.email) return null;
  const cls = cn('grid h-9 w-9 place-items-center rounded-full transition hover:-translate-y-0.5', dark ? 'bg-white/10 text-white hover:bg-white hover:text-ink' : 'bg-ink text-white hover:bg-brand');
  return (
    <div className="flex gap-2">
      {links.map(([name, href, label]) => (
        <a key={name} href={href} target="_blank" rel="noreferrer" aria-label={`${m.name} on ${label}`} className={cls}>
          <SocialIcon name={name} className="h-3.5 w-3.5" />
        </a>
      ))}
      {m.socials?.email && (
        <a href={`mailto:${m.socials.email}`} aria-label={`Email ${m.name}`} className={cls}>
          <Mail className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/** Large split cards for the founders. */
function Founders({ founders }) {
  if (!founders.length) return null;
  return (
    <section className="container-page py-20 lg:py-28" aria-labelledby="founders-h">
      <Reveal className="mb-12 max-w-2xl">
        <p className="eyebrow inline-flex items-center gap-3">
          <span className="h-px w-8 bg-ink/30" /> Founders
        </p>
        <h2 id="founders-h" className="display mt-4 text-4xl sm:text-5xl">
          Where it <span className="serif-accent text-brand">all started.</span>
        </h2>
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-2">
        {founders.map((m, i) => (
          <Reveal key={m._id} delay={i * 0.12}>
            <article className="group grid h-full overflow-hidden rounded-[2rem] bg-ink text-white sm:grid-cols-[0.9fr_1.1fr]">
              <div className="relative min-h-[300px] overflow-hidden">
                {m.image?.url && <img src={m.image.url} alt={`${m.name}, ${m.position}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-ink/40" />
              </div>
              <div className="relative flex flex-col p-7 sm:p-8">
                <div aria-hidden className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-brand/40 blur-3xl" />
                <Quote className="relative h-7 w-7 text-brand-tint" aria-hidden />
                <p className="relative mt-4 text-[15px] leading-7 text-white/80">{m.bio}</p>
                {m.funFact && (
                  <p className="relative mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] leading-6 text-white/70">
                    <span className="font-bold text-white">Fun fact · </span>
                    {m.funFact}
                  </p>
                )}
                <div className="relative mt-auto flex items-end justify-between gap-4 pt-6">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{m.name}</h3>
                    <p className="text-sm text-white/60">{m.position}</p>
                  </div>
                  <Socials m={m} dark />
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function MemberCard({ m }) {
  return (
    <motion.article whileHover="hover" initial="rest" animate="rest" className="group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-sand">
        {m.image?.url ? (
          <motion.img
            src={m.image.url}
            alt={`${m.name}, ${m.position}`}
            loading="lazy"
            className="h-full w-full object-cover grayscale-[40%] transition-[filter] duration-700 group-hover:grayscale-0"
            variants={{ rest: { scale: 1 }, hover: { scale: 1.07 } }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-5xl font-extrabold text-ink/20">{initials(m.name)}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />

        <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
          {m.department && <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold tracking-wide text-ink backdrop-blur">{m.department}</span>}
        </div>

        {/* Default caption */}
        <motion.div className="absolute inset-x-5 bottom-5 text-white" variants={{ rest: { opacity: 1, y: 0 }, hover: { opacity: 0, y: 12 } }} transition={{ duration: 0.3 }}>
          <h3 className="text-xl font-bold tracking-tight">{m.name}</h3>
          <p className="text-sm text-white/75">{m.position}</p>
          {m.location && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5" /> {m.location}
            </p>
          )}
        </motion.div>

        {/* Hover panel (pointer devices) */}
        <motion.div
          className="absolute inset-x-3 bottom-3 hidden rounded-[1.5rem] bg-white/90 p-5 backdrop-blur-xl [@media(hover:hover)]:block"
          variants={{ rest: { opacity: 0, y: 24 }, hover: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <p className="text-sm font-bold">{m.name}</p>
          <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{m.bio}</p>
          {m.favourite && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand-dark">
              <Droplets className="h-3.5 w-3.5" /> Carries the {m.favourite.replace(/\s+(Stainless Steel|Insulated)\b.*/, '')}
            </p>
          )}
          <div className="mt-4">
            <Socials m={m} />
          </div>
        </motion.div>
      </div>

      {/* Touch devices: details below the photo */}
      <div className="mt-4 [@media(hover:hover)]:hidden">
        <p className="text-sm leading-6 text-muted">{m.bio}</p>
        {m.funFact && <p className="mt-2 text-[13px] leading-6 text-ink-soft">✦ {m.funFact}</p>}
        <div className="mt-3">
          <Socials m={m} />
        </div>
      </div>
      {m.funFact && <p className="mt-4 hidden text-[13px] leading-6 text-muted [@media(hover:hover)]:block">✦ {m.funFact}</p>}
    </motion.article>
  );
}

function Directory({ members, isLoading, error, refetch }) {
  const [dept, setDept] = useState('All');
  const depts = useMemo(() => ['All', ...new Set(members.map((m) => m.department).filter(Boolean))], [members]);
  const visible = dept === 'All' ? members : members.filter((m) => m.department === dept);

  return (
    <section className="relative overflow-hidden bg-sand py-20 lg:py-28" aria-labelledby="team-h">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div className="container-page relative">
        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <Reveal className="max-w-2xl">
            <p className="eyebrow inline-flex items-center gap-3">
              <span className="h-px w-8 bg-ink/30" /> The crew
            </p>
            <h2 id="team-h" className="display mt-4 text-4xl sm:text-5xl">
              Meet <span className="serif-accent text-brand">everyone.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted">Hover a card to find out what each of us carries every day.</p>
          </Reveal>
          {depts.length > 2 && (
            <Reveal delay={0.1}>
              <LayoutGroup id="team-tabs">
                <div role="tablist" aria-label="Filter by department" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:flex-wrap sm:rounded-full sm:border sm:border-line sm:bg-surface/80 sm:p-1.5 sm:backdrop-blur">
                  {depts.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="tab"
                      aria-selected={dept === d}
                      onClick={() => setDept(d)}
                      className={cn('relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors', dept === d ? 'text-white' : 'text-ink-soft hover:text-ink')}
                    >
                      {dept === d && <motion.span layoutId="team-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                      <span className="relative">{d}</span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </Reveal>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-[2rem]" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !members.length ? (
          <EmptyState icon={Users} title="Team coming soon" description="We’re putting together our team page." />
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {visible.map((m, i) => (
                <motion.div
                  key={m._id}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.55, delay: Math.min(i, 7) * 0.05, ease: EASE }}
                >
                  <MemberCard m={m} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function Timeline() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <section className="container-page py-20 lg:py-28" aria-labelledby="journey-h">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/30" /> Our journey
          </p>
          <h2 id="journey-h" className="display mt-4 text-4xl sm:text-5xl">
            Four years, <span className="serif-accent text-brand">one obsession.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-muted">From a garage workbench to doorsteps across India — here’s how a leaky bottle turned into a company.</p>
        </Reveal>
        <div ref={ref} className="relative pl-10">
          <div aria-hidden className="absolute top-2 bottom-2 left-[11px] w-[2px] rounded-full bg-line" />
          <motion.div aria-hidden style={{ scaleY }} className="absolute top-2 bottom-2 left-[11px] w-[2px] origin-top rounded-full bg-gradient-to-b from-brand via-brand-tint to-[#e2557a]" />
          <ol className="space-y-10">
            {MILESTONES.map((m, i) => (
              <motion.li
                key={m.year}
                className="relative"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <span className="absolute top-1 -left-10 grid h-6 w-6 place-items-center rounded-full border-2 border-brand bg-canvas">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                </span>
                <div className="card p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className={cn('display text-3xl', i === MILESTONES.length - 1 ? 'text-shimmer' : 'text-brand')}>{m.year}</span>
                  <h3 className="mt-2 text-lg font-bold tracking-tight">{m.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-7 text-muted">{m.text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default function Team() {
  const { data, isLoading, error, refetch } = useTeam();
  const members = useMemo(() => data || [], [data]);
  const founders = members.filter((m) => /founder/i.test(m.position)).slice(0, 2);

  return (
    <PageTransition>
      <Seo title="Our team" description="Meet the designers, engineers and makers behind Sipcraft." />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="bg-grid absolute inset-0" />
        <div aria-hidden className="aurora-blob -top-32 right-[-8%] h-[480px] w-[480px] animate-aurora bg-brand-tint" />
        <div aria-hidden className="aurora-blob bottom-[-20%] left-[-10%] h-[380px] w-[380px] animate-aurora-alt bg-[#f3c8d6]" />
        <div className="container-page relative grid items-center gap-10 pt-14 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20 lg:pb-24">
          <div>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pr-4 pl-1.5 text-[13px] font-semibold backdrop-blur">
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] text-white">{members.length || 8} people</span> Designed in Bengaluru
            </motion.p>
            <h1 className="display mt-6 text-5xl sm:text-7xl">
              <SplitReveal text="The people" /> <SplitReveal text="behind the sip." delay={0.2} className="serif-accent text-shimmer pr-2" />
            </h1>
            <Reveal delay={0.3}>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">A small, obsessive team of designers, engineers and customer champions. We test every lid, answer every message and name every colour ourselves.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="#team-h" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Meet the team
                </Button>
                <Button href="#careers-h" size="lg" variant="secondary">
                  Open roles
                </Button>
              </div>
            </Reveal>
          </div>
          <AvatarCloud members={members} />
        </div>

        {/* Stats */}
        <div className="container-page relative pb-16">
          <Stagger className="grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] border border-line bg-line lg:grid-cols-4">
            {STATS.map((s) => (
              <StaggerItem key={s.label} className="bg-surface/90 p-6 backdrop-blur sm:p-8">
                <p className="display text-4xl sm:text-5xl">
                  <CountUp to={s.to} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm text-muted">{s.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <Founders founders={founders} />
      <Directory members={members} isLoading={isLoading} error={error} refetch={refetch} />

      {/* Values */}
      <section className="container-page py-20 lg:py-28" aria-labelledby="values-h">
        <Reveal className="mb-12 max-w-2xl">
          <p className="eyebrow inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/30" /> How we work
          </p>
          <h2 id="values-h" className="display mt-4 text-4xl sm:text-5xl">
            Four things we <span className="serif-accent text-brand">won’t compromise on.</span>
          </h2>
        </Reveal>
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, text }, i) => (
            <StaggerItem key={title} className="h-full">
              <SpotlightCard className="h-full p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand transition duration-500 group-hover:rotate-[-8deg] group-hover:bg-brand group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="display text-outline text-4xl">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-muted">{text}</p>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <MarqueeBand items={['Curious', 'Obsessive', 'Kind', 'Hydrated']} className="border-y border-line" />

      <Timeline />

      {/* Careers */}
      <section className="container-page pb-4" aria-labelledby="careers-h">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-6 py-14 text-white sm:px-12 lg:px-16 lg:py-16">
            <div aria-hidden className="aurora-blob -top-24 -right-24 h-80 w-80 animate-aurora bg-brand" />
            <div aria-hidden className="aurora-blob -bottom-32 -left-20 h-72 w-72 animate-aurora-alt bg-[#e2557a]/60" />
            <div aria-hidden className="grain absolute inset-0" />
            <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">Careers</p>
                <h2 id="careers-h" className="display mt-3 text-4xl sm:text-5xl">
                  Want to build <span className="serif-accent text-brand-tint">with us?</span>
                </h2>
                <p className="mt-4 max-w-md text-white/65">We’re always looking for curious people who sweat the small stuff. Don’t see your role? Tell us what you’d bring anyway.</p>
                <Button to="/contact?subject=Careers" variant="light" className="mt-8" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Get in touch
                </Button>
              </div>
              <ul className="space-y-3">
                {ROLES.map((r, i) => (
                  <motion.li key={r.title} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }}>
                    <Link
                      to={`/contact?subject=${encodeURIComponent(`Careers – ${r.title}`)}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/30 hover:bg-white/[0.08]"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
                          <Briefcase className="h-5 w-5 text-brand-tint" />
                        </span>
                        <span>
                          <span className="block font-bold">{r.title}</span>
                          <span className="text-sm text-white/55">
                            {r.team} · {r.place}
                          </span>
                        </span>
                      </span>
                      <ArrowUpRight className="h-5 w-5 shrink-0 text-white/50 transition duration-300 group-hover:rotate-45 group-hover:text-white" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>
    </PageTransition>
  );
}
