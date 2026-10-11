import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthActions } from '@/hooks/useAuth';
import { getErrorMessage } from '@/api/client';
import { loginSchema } from '@/validators/schemas';
import { Input } from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import AuthShell from './AuthShell';

export const safeRedirect = (value, fallback) => (value && value.startsWith('/') && !value.startsWith('//') ? value : fallback);

export default function Login() {
  const { login } = useAuthActions();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(safeRedirect(params.get('redirect'), user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, save favourites and check out faster." footer={<>New to Sipcraft? <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect'))}` : ''}`} className="font-bold text-ink underline-offset-4 hover:underline">Create an account</Link></>}>
      <Seo title="Sign in" />
      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" leftIcon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
