import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Camera, Trash2, Mail, CalendarDays, ShieldCheck, Check, User, Phone, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { userApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { profileSchema } from '@/validators/schemas';
import { Input } from '@/components/ui/Form';
import { PageTransition } from '@/components/ui/Motion';
import { DashHeader, Panel } from '@/components/dashboard/DashUI';
import { Avatar, profileCompletion } from '@/layouts/DashboardLayout';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];

function CompletionRing({ value }) {
  const c = 2 * Math.PI * 42;
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#6d5bd0" />
            <stop offset="1" stopColor="#e2557a" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-line)" strokeWidth="8" />
        <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#ring-grad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.4, ease: EASE }} />
      </svg>
      <span className="text-2xl font-extrabold tracking-tight">{value}%</span>
    </div>
  );
}

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef(null);
  const { register, handleSubmit, setError, formState: { errors, isDirty }, reset } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', phone: user?.phone || '' },
  });

  const save = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (res) => {
      setUser(res.data.user);
      reset({ name: res.data.user.name, phone: res.data.user.phone || '' });
      toast.success('Profile updated');
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  const avatar = useMutation({
    mutationFn: userApi.uploadAvatar,
    onSuccess: (res) => {
      setUser(res.data.user);
      toast.success('Profile photo updated');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const removeAvatar = useMutation({
    mutationFn: userApi.removeAvatar,
    onSuccess: (res) => {
      setUser(res.data.user);
      toast.success('Profile photo removed');
    },
  });

  const completion = profileCompletion(user);
  const checklist = [
    ['Name', Boolean(user?.name)],
    ['Email address', Boolean(user?.email)],
    ['Phone number', Boolean(user?.phone)],
    ['Profile photo', Boolean(user?.avatar?.url)],
  ];

  return (
    <PageTransition>
      <Seo title="Profile" noindex />
      <DashHeader icon={User} eyebrow="Account" title="Your" accent="profile." description="Keep your details up to date so deliveries and order updates always reach you." />

      {/* Cover + identity */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="mt-8 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft">
        <div className="relative h-32 overflow-hidden bg-gradient-to-r from-brand via-brand-tint to-[#f3a9bd] bg-[length:200%_100%] animate-gradient-x sm:h-40">
          <div aria-hidden className="grain absolute inset-0" />
          <div aria-hidden className="absolute -right-10 -bottom-16 h-48 w-48 rounded-full border-[18px] border-white/15" />
          <div aria-hidden className="absolute top-6 right-40 h-16 w-16 rounded-full border-[10px] border-white/10" />
        </div>
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end sm:px-8">
          <div className="group relative -mt-14 h-28 w-28 shrink-0">
            <Avatar user={user} className="h-28 w-28 text-3xl ring-[6px] ring-surface" rounded="rounded-[2rem]" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 grid place-items-center rounded-[2rem] bg-ink/55 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={user?.avatar?.url ? 'Change photo' : 'Upload photo'}
            >
              <Camera className="h-6 w-6" />
            </button>
            {avatar.isPending && (
              <span className="absolute inset-0 grid place-items-center rounded-[2rem] bg-ink/60">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
              {user?.name} <BadgeCheck className="h-5 w-5 text-brand" aria-label="Verified customer" />
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user?.email}
              </span>
              {user?.createdAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Member since {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" leftIcon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()} loading={avatar.isPending}>
              {user?.avatar?.url ? 'Change photo' : 'Upload photo'}
            </Button>
            {user?.avatar?.url && (
              <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => removeAvatar.mutate()} loading={removeAvatar.isPending}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > 5 * 1024 * 1024) return toast.error('Please choose an image under 5 MB');
              if (f) avatar.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
      </motion.section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <Panel title="Personal details" icon={User} description="Used for deliveries and order updates." delay={0.1}>
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-5 sm:grid-cols-2" noValidate>
            <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
            <Input label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
            <Input className="sm:col-span-2" label="Email" value={user?.email || ''} readOnly disabled hint="Contact support to change your email address." />
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5 sm:col-span-2">
              <Button type="submit" loading={save.isPending} disabled={!isDirty}>
                Save changes
              </Button>
              {isDirty && (
                <motion.button initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} type="button" onClick={() => reset()} className="text-sm font-semibold text-muted hover:text-ink">
                  Discard
                </motion.button>
              )}
              <span className={cn('ml-auto inline-flex items-center gap-1.5 text-xs font-semibold transition', isDirty ? 'text-warning' : 'text-success')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isDirty ? 'bg-warning' : 'bg-success')} />
                {isDirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
            </div>
          </form>
        </Panel>

        <Panel title="Profile strength" icon={ShieldCheck} delay={0.18}>
          <div className="flex flex-col items-center text-center">
            <CompletionRing value={completion} />
            <p className="mt-3 text-sm text-muted">{completion === 100 ? 'Looking great — your profile is complete.' : 'A complete profile makes checkout faster.'}</p>
          </div>
          <ul className="mt-6 space-y-2.5">
            {checklist.map(([label, done], i) => (
              <motion.li key={label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }} className="flex items-center gap-3 text-sm">
                <span className={cn('grid h-6 w-6 place-items-center rounded-full', done ? 'bg-success text-white' : 'border-2 border-dashed border-line-strong text-transparent')}>
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className={cn(done ? 'text-ink' : 'text-muted')}>{label}</span>
                {!done && label === 'Phone number' && <Phone className="ml-auto h-3.5 w-3.5 text-subtle" />}
                {!done && label === 'Profile photo' && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="ml-auto text-xs font-semibold text-brand hover:underline">
                    Add
                  </button>
                )}
              </motion.li>
            ))}
          </ul>
        </Panel>
      </div>
    </PageTransition>
  );
}
