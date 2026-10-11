import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { contentApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useSettings } from '@/hooks/queries';
import { contactSchema } from '@/validators/schemas';
import { Input, Textarea } from '@/components/ui/Form';
import { Reveal, PageTransition } from '@/components/ui/Motion';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';

export default function Contact() {
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const { data: settings } = useSettings();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', subject: params.get('subject') || '', message: '' },
  });
  const mutation = useMutation({
    mutationFn: contentApi.contact,
    onSuccess: (res) => {
      toast.success(res.message);
      setSent(true);
      reset({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '' });
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });

  const details = [
    [Mail, 'Email', settings?.supportEmail || 'care@sipcraft.in', `mailto:${settings?.supportEmail || 'care@sipcraft.in'}`],
    [Phone, 'Phone', settings?.supportPhone || '+91 80 4718 2200', `tel:${(settings?.supportPhone || '+918047182200').replace(/\s/g, '')}`],
    [MapPin, 'Studio', settings?.address || 'Bengaluru, India'],
    [Clock, 'Hours', 'Mon – Sat, 10 am – 7 pm IST'],
  ];

  return (
    <PageTransition className="container-page py-14 lg:py-20">
      <Seo title="Contact us" description="Questions about an order, bulk gifting or our products? Reach the Sipcraft team — we reply within one business day." />
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow">Contact</p>
          <h1 className="display mt-4 text-5xl sm:text-6xl">
            Let’s <span className="serif-accent text-brand">talk.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-muted">Questions about an order, a bulk gifting project or just which tumbler fits your cup holder? We reply within one business day.</p>
          <ul className="mt-10 space-y-3">
            {details.map(([Icon, label, value, href]) => (
              <li key={label} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wider text-subtle uppercase">{label}</p>
                  {href ? (
                    <a href={href} className="font-semibold hover:underline">
                      {value}
                    </a>
                  ) : (
                    <p className="font-semibold">{value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="card p-6 sm:p-10">
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-12 text-center">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
                  <h2 className="mt-6 text-2xl font-bold">Message received</h2>
                  <p className="mx-auto mt-2 max-w-sm text-muted">Thanks for reaching out. A member of our team will reply to your email within one business day.</p>
                  <Button variant="secondary" className="mt-8" onClick={() => setSent(false)}>
                    Send another message
                  </Button>
                </motion.div>
              ) : (
                <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-5 sm:grid-cols-2" noValidate>
                  <Input label="Name" autoComplete="name" required error={errors.name?.message} {...register('name')} />
                  <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
                  <Input label="Phone" type="tel" autoComplete="tel" optional error={errors.phone?.message} {...register('phone')} />
                  <Input label="Subject" required error={errors.subject?.message} {...register('subject')} />
                  <Textarea className="sm:col-span-2" label="Message" rows={6} required error={errors.message?.message} placeholder="How can we help?" {...register('message')} />
                  <div className="sm:col-span-2">
                    <Button type="submit" size="lg" loading={mutation.isPending} rightIcon={<Send className="h-4 w-4" />}>
                      Send message
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
