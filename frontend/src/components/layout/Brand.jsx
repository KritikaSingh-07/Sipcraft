import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function Logo({ className, light }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2', className)} aria-label="Sipcraft home">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0 transition-transform duration-500 group-hover:-rotate-6" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#fff' : '#17161C'} />
        <path d="M11 9h10l-1.3 15.2a1.6 1.6 0 0 1-1.6 1.4h-4.2a1.6 1.6 0 0 1-1.6-1.4Z" fill="#B9A8E8" />
        <rect x="10" y="7" width="12" height="3" rx="1.5" fill={light ? '#17161C' : '#EFEBFB'} />
        <path d="m18 7 1.6-4" stroke={light ? '#17161C' : '#EFEBFB'} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className={cn('text-[21px] font-extrabold tracking-[-0.04em]', light ? 'text-white' : 'text-ink')}>
        sipcraft<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

const paths = {
  instagram:
    'M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2Zm0 4.7a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2Zm0 8.4a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6Zm5.3-9.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  facebook: 'M13.5 21.9v-7.7h2.6l.4-3h-3V9.3c0-.9.3-1.5 1.5-1.5h1.6V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6v7.7h3.1Z',
  twitter: 'M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z',
  youtube:
    'M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15V9l5.8 3-5.8 3Z',
  linkedin:
    'M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm1.8 13.1H3.5V9h3.6v11.5ZM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0Z',
};

/** Brand social icons (lucide-react v1 no longer ships brand marks). */
export function SocialIcon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export const SOCIAL_LINKS = [
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' },
  { name: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/' },
  { name: 'twitter', label: 'X (Twitter)', href: 'https://x.com/' },
  { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/' },
];
