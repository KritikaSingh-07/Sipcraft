import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthActions } from '@/hooks/useAuth';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { registerSchema } from '@/validators/schemas';
import { Input, Checkbox } from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import AuthShell from './AuthShell';
import { safeRedirect } from './Login';
import { cn } from '@/utils/cn';

const RULES = [
  [/.{8,}/, '8+ characters'],
  [/[A-Z]/, 'Uppercase'],
  [/[a-z]/, 'Lowercase'],
  [/[0-9]/, 'Number'],
];

export default function Register() {
  const { register: signUp } = useAuthActions();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { terms: false } });
  const pw = watch('password') || '';

  const onSubmit = async ({ terms, ...values }) => {
    setFormError('');
    try {
      const user = await signUp(values);
      toast.success(`Welcome to Sipcraft, ${user.name.split(' ')[0]}!`);
      navigate(safeRedirect(params.get('redirect'), '/dashboard'), { replace: true });
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join for faster checkout, order tracking and 10% off your first order."
      image="/media/products/luna-matte-tumbler-4.webp"
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-bold text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Seo title="Create account" />
      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input className="sm:col-span-2" label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" autoComplete="tel" optional error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <ul className="flex flex-wrap gap-2 sm:col-span-2" aria-label="Password requirements">
          {RULES.map(([rx, label]) => {
            const ok = rx.test(pw);
            return (
              <li key={label} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition', ok ? 'bg-success-soft text-success' : 'bg-sand text-muted')}>
                <Check className={cn('h-3 w-3', !ok && 'opacity-30')} /> {label}
              </li>
            );
          })}
        </ul>
        <div className="sm:col-span-2">
          <Checkbox
            label={
              <>
                I agree to the{' '}
                <Link to="/terms" className="underline" target="_blank">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="underline" target="_blank">
                  Privacy Policy
                </Link>
              </>
            }
            {...register('terms')}
          />
          {errors.terms && <p className="mt-1.5 text-[13px] font-medium text-danger">{errors.terms.message}</p>}
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting} className="sm:col-span-2">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
