import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, LogOut, KeyRound, Check, Lock, Smartphone, Fingerprint, MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useAuthActions } from '@/hooks/useAuth';
import { useConfirm } from '@/contexts/ConfirmContext';
import { changePasswordSchema } from '@/validators/schemas';
import { Input } from '@/components/ui/Form';
import { PageTransition } from '@/components/ui/Motion';
import { DashHeader, Panel } from '@/components/dashboard/DashUI';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { cn } from '@/utils/cn';

const RULES = [
  ['At least 8 characters', (v) => v.length >= 8],
  ['An uppercase letter', (v) => /[A-Z]/.test(v)],
  ['A lowercase letter', (v) => /[a-z]/.test(v)],
  ['A number', (v) => /\d/.test(v)],
  ['A symbol (bonus)', (v) => /[^A-Za-z0-9]/.test(v)],
];
const LEVELS = [
  { label: 'Too weak', color: 'bg-danger' },
  { label: 'Weak', color: 'bg-danger' },
  { label: 'Fair', color: 'bg-warning' },
  { label: 'Good', color: 'bg-[#7cb342]' },
  { label: 'Strong', color: 'bg-success' },
  { label: 'Excellent', color: 'bg-success' },
];

function StrengthMeter({ value = '' }) {
  const passed = RULES.map(([, test]) => test(value));
  const score = passed.filter(Boolean).length;
  const level = LEVELS[value ? score : 0];
  return (
    <div className="rounded-2xl bg-sand/70 p-4">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted">Password strength</span>
        <span className={cn(!value && 'text-subtle')}>{value ? level.label : '—'}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.div className={cn('h-full rounded-full', level.color)} initial={false} animate={{ width: value && i < score ? '100%' : '0%' }} transition={{ duration: 0.35, delay: i * 0.04 }} />
          </div>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {RULES.map(([label], i) => (
          <li key={label} className={cn('flex items-center gap-2 text-[13px] transition-colors', passed[i] ? 'text-ink' : 'text-muted')}>
            <motion.span animate={{ scale: passed[i] ? [1, 1.25, 1] : 1 }} className={cn('grid h-4 w-4 place-items-center rounded-full transition-colors', passed[i] ? 'bg-success text-white' : 'bg-line text-transparent')}>
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </motion.span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TIPS = [
  { icon: Fingerprint, title: 'Use a unique password', text: 'Don’t reuse a password from another site.' },
  { icon: Smartphone, title: 'Try a password manager', text: 'Let it generate and remember strong passwords.' },
  { icon: MailWarning, title: 'Watch for phishing', text: 'We’ll never ask for your password by email or phone.' },
];

export default function ChangePassword() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { register, handleSubmit, reset, setError, watch, formState: { errors } } = useForm({ resolver: zodResolver(changePasswordSchema) });
  const newPassword = watch('newPassword') || '';

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (res) => {
      setAccessToken(res.data.accessToken);
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(res.message);
    },
    onError: (err) => !applyServerErrors(err, setError) && setError('currentPassword', { message: getErrorMessage(err) }),
  });

  return (
    <PageTransition>
      <Seo title="Change password" noindex />
      <DashHeader icon={ShieldCheck} eyebrow="Security" title="Keep your account" accent="locked tight." description="Update your password and manage where you’re signed in." />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel title="Change password" icon={KeyRound} description="Changing your password signs you out of every other device.">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5" noValidate>
            <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
              <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            </div>
            <StrengthMeter value={newPassword} />
            <Button type="submit" loading={mutation.isPending} leftIcon={<Lock className="h-4 w-4" />}>
              Update password
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="Security tips" icon={ShieldCheck} delay={0.1} bodyClassName="space-y-4 p-5">
            {TIPS.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-[13px] leading-5 text-muted">{text}</p>
                </div>
              </motion.div>
            ))}
          </Panel>

          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }} className="relative overflow-hidden rounded-[1.75rem] border border-danger/20 bg-danger-soft/60 p-6">
            <div aria-hidden className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-danger/10 blur-2xl" />
            <h2 className="relative flex items-center gap-2 font-bold">
              <LogOut className="h-4 w-4 text-danger" /> Sign out everywhere
            </h2>
            <p className="relative mt-1.5 text-[13px] leading-5 text-muted">Lost a device or used a shared computer? End every active session, including this one.</p>
            <Button
              variant="danger-soft"
              size="sm"
              className="relative mt-4"
              onClick={async () => {
                if (!(await confirm({ title: 'Sign out of all devices?', description: 'You’ll need to sign in again everywhere.', confirmText: 'Sign out everywhere', tone: 'danger' }))) return;
                await logout({ everywhere: true });
                toast.success('Signed out from all devices');
                navigate('/login');
              }}
            >
              Sign out of all devices
            </Button>
          </motion.section>
        </div>
      </div>
    </PageTransition>
  );
}
