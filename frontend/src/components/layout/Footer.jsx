import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Mail, MapPin, Phone, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Logo, SocialIcon, SOCIAL_LINKS } from './Brand';
import { contentApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useSettings, useCategories } from '@/hooks/queries';

export function NewsletterForm({ dark = true, className = '' }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const mutation = useMutation({
    mutationFn: () => contentApi.newsletter(email),
    onSuccess: (res) => {
      toast.success(res.message);
      setDone(true);
      setEmail('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return toast.error('Please enter a valid email address');
        mutation.mutate();
      }}
    >
      <label htmlFor={`nl-${dark}`} className="sr-only">
        Email address
      </label>
      <div className={`flex items-center gap-2 rounded-full p-1.5 ${dark ? 'bg-white/10 ring-1 ring-white/15 focus-within:ring-white/40' : 'bg-surface ring-1 ring-line-strong focus-within:ring-ink'}`}>
        <input
          id={`nl-${dark}`}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDone(false);
          }}
          placeholder="you@email.com"
          className={`h-10 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none ${dark ? 'text-white placeholder:text-white/40' : 'placeholder:text-subtle'}`}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${dark ? 'bg-white text-ink hover:bg-brand-tint' : 'bg-ink text-white hover:bg-ink-soft'}`}
          aria-label="Subscribe"
        >
          {mutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : done ? (
            <Check className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </form>
  );
}

export default function Footer() {
  const { data: settings } = useSettings();
  const { data: categories } = useCategories();
  const cols = [
    {
      title: 'Shop',
      links: [{ to: '/products', label: 'All products' }, ...(categories || []).slice(0, 5).map((c) => ({ to: `/products?category=${c.slug}`, label: c.name }))],
    },
    {
      title: 'Company',
      links: [
        { to: '/about', label: 'Our story' },
        { to: '/services', label: 'Services' },
        { to: '/team', label: 'Team' },
        { to: '/contact', label: 'Contact' },
      ],
    },
    {
      title: 'Support',
      links: [
        { to: '/orders', label: 'Track order' },
        { to: '/shipping', label: 'Shipping policy' },
        { to: '/returns', label: 'Returns' },
        { to: '/refund', label: 'Refund policy' },
        { to: '/privacy', label: 'Privacy policy' },
        { to: '/terms', label: 'Terms & conditions' },
      ],
    },
  ];

  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="container-page pt-16 pb-10 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-5 text-[15px] leading-7 text-white/60">Thoughtfully designed tumblers and sippers that keep up with your day — from the first coffee to the last refill.</p>
            {settings?.newsletterEnabled !== false && (
              <>
                <p className="mt-8 text-sm font-bold">Join the Sipcraft list</p>
                <p className="mt-1 text-sm text-white/50">New colours, early drops and the occasional surprise.</p>
                <NewsletterForm className="mt-4" />
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {cols.map((col) => (
              <div key={col.title}>
                <h3 className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link to={l.to} className="link-underline text-sm text-white/75 hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-1">
              <h3 className="text-[11px] font-bold tracking-[0.2em] text-white/40 uppercase">Get in touch</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li className="flex gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <a href={`mailto:${settings?.supportEmail || 'care@sipcraft.in'}`} className="hover:text-white">
                    {settings?.supportEmail || 'care@sipcraft.in'}
                  </a>
                </li>
                <li className="flex gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <a href={`tel:${(settings?.supportPhone || '').replace(/\s/g, '')}`} className="hover:text-white">
                    {settings?.supportPhone || '+91 80 4718 2200'}
                  </a>
                </li>
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <span>{settings?.address || 'Bengaluru, India'}</span>
                </li>
              </ul>
              <div className="mt-6 flex gap-2">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.name}
                    href={settings?.socials?.[s.name] || s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white hover:text-ink"
                  >
                    <SocialIcon name={s.name} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 overflow-hidden" aria-hidden>
          <p className="display text-center text-[19vw] leading-[0.8] text-white/[0.05] select-none lg:text-[220px]">sipcraft</p>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row">
          <p>© {new Date().getFullYear()} Sipcraft Hydration Pvt. Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Secure payments by Razorpay</span>
            <span className="flex gap-1.5">
              {['UPI', 'VISA', 'RuPay', 'MC'].map((m) => (
                <span key={m} className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white/60">
                  {m}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
