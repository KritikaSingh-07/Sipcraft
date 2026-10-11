import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { useAuthStore } from '@/store/authStore';

const COPY = {
  404: { title: 'This page wandered off', text: 'The page you’re looking for doesn’t exist or has moved. Let’s get you back to something refreshing.', eyebrow: 'Error 404' },
  401: { title: 'Please sign in', text: 'You need to be signed in to view this page.', eyebrow: 'Unauthorized' },
  403: { title: 'Members only', text: 'Your account doesn’t have permission to view this page.', eyebrow: 'Forbidden' },
};

export default function StatusPage({ code = 404, compact }) {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const c = COPY[code];
  return (
    <div className={compact ? 'py-16' : 'container-page py-20 lg:py-28'}>
      <Seo title={c.title} noindex />
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="display text-[120px] text-ink/[0.06] sm:text-[180px]" aria-hidden>
            {code}
          </span>
          <motion.svg viewBox="0 0 60 90" className="absolute top-1/2 left-1/2 h-28 -translate-x-1/2 -translate-y-1/2" animate={{ rotate: [0, -6, 6, 0], y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} aria-hidden>
            <path d="M10 20h40l-4.5 62a5 5 0 0 1-5 4.6H19.5a5 5 0 0 1-5-4.6Z" fill="#B9A8E8" />
            <rect x="7" y="12" width="46" height="10" rx="5" fill="#17161C" />
            <path d="m36 12 5-11" stroke="#17161C" strokeWidth="4" strokeLinecap="round" />
            <circle cx="24" cy="48" r="2.5" fill="#17161C" />
            <circle cx="36" cy="48" r="2.5" fill="#17161C" />
            <path d="M24 60c3-3 9-3 12 0" stroke="#17161C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </motion.svg>
        </motion.div>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{c.title}</h1>
        <p className="mt-4 text-muted">{c.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {code === 401 && status !== 'authenticated' ? (
            <Button to="/login">Sign in</Button>
          ) : (
            <Button to="/" leftIcon={<Home className="h-4 w-4" />}>
              Go home
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
