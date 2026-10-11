import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { resetSchema } from '@/validators/schemas';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import AuthShell from './AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema) });

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <EmptyState
        icon={KeyRound}
        title="This reset link is invalid"
        description="It may have expired or been used already. Request a new one to continue."
        action={<Button to="/forgot-password">Request a new link</Button>}
      />
    );
  }

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const res = await authApi.resetPassword({ token, ...values });
      clearSession(); // every session was revoked server-side
      toast.success(res.message);
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="For your security, you’ll be signed out of all devices." footer={<Link to="/login" className="font-bold text-ink hover:underline">Back to sign in</Link>}>
      <Seo title="Choose a new password" noindex />
      {formError && (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {formError}{' '}
            <Link to="/forgot-password" className="underline">
              Request a new link
            </Link>
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="New password" type="password" autoComplete="new-password" hint="8+ characters with upper & lower case letters and a number" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
