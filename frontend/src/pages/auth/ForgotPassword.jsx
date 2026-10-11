import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailCheck, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { forgotSchema } from '@/validators/schemas';
import { Input } from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import AuthShell from './AuthShell';

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async ({ email }) => {
    try {
      await authApi.forgotPassword({ email });
      setSentTo(email);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AuthShell
      title={sentTo ? 'Check your inbox' : 'Forgot password?'}
      subtitle={sentTo ? undefined : 'Enter your email and we’ll send you a secure link to reset it.'}
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-ink hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      <Seo title="Reset password" />
      {sentTo ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-success-soft p-6">
          <MailCheck className="h-8 w-8 text-success" />
          <p className="mt-4 text-[15px] leading-7">
            If an account exists for <b>{sentTo}</b>, you’ll receive a reset link shortly. The link expires in 15 minutes and works once.
          </p>
          <button onClick={() => setSentTo('')} className="mt-4 text-sm font-semibold underline">
            Use a different email
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" leftIcon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register('email')} />
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
