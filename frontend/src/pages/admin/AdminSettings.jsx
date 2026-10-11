import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Circle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { settingsSchema } from '@/validators/schemas';
import { AdminPage } from '@/components/admin/AdminUI';
import { Input, Textarea, Switch } from '@/components/ui/Form';
import { FullPageLoader, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';

function Integration({ ok, label, detail }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-sand p-4">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-subtle" />}
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminApi.settings });
  const { register, handleSubmit, control, reset, setError, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (data) {
      reset({
        storeName: data.storeName,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone || '',
        address: data.address || '',
        announcement: data.announcement || '',
        shippingFee: data.shippingFee,
        freeShippingThreshold: data.freeShippingThreshold,
        taxRate: data.taxRate,
        reviewsRequireApproval: Boolean(data.reviewsRequireApproval),
        returnPolicy: data.returnPolicy || '',
        returnWindowDays: data.returnWindowDays ?? 7,
        newsletterEnabled: data.newsletterEnabled !== false,
        instagram: data.socials?.instagram || '',
        facebook: data.socials?.facebook || '',
        twitter: data.socials?.twitter || '',
        youtube: data.socials?.youtube || '',
      });
    }
  }, [data, reset]);

  const save = useMutation({
    mutationFn: ({ instagram, facebook, twitter, youtube, ...v }) => adminApi.updateSettings({ ...v, socials: { instagram, facebook, twitter, youtube } }),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <FullPageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const i = data.integrations || {};

  return (
    <AdminPage title="Settings" description="Store details, shipping, tax and moderation.">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Store details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Store name" error={errors.storeName?.message} {...register('storeName')} />
              <Input label="Support email" type="email" error={errors.supportEmail?.message} {...register('supportEmail')} />
              <Input label="Support phone" error={errors.supportPhone?.message} {...register('supportPhone')} />
              <Input label="Address" error={errors.address?.message} {...register('address')} />
              <Textarea className="sm:col-span-2" label="Announcement bar" rows={2} hint="Separate messages with ·" error={errors.announcement?.message} {...register('announcement')} />
            </div>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Shipping & tax</h2>
            <p className="mt-0.5 text-sm text-muted">Applied server-side to every cart and checkout.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Input label="Shipping fee (₹)" type="number" error={errors.shippingFee?.message} {...register('shippingFee')} />
              <Input label="Free shipping above (₹)" type="number" error={errors.freeShippingThreshold?.message} {...register('freeShippingThreshold')} />
              <Input label="GST rate (%)" type="number" hint="Prices are GST-inclusive" error={errors.taxRate?.message} {...register('taxRate')} />
            </div>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Returns</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]">
              <Input label="Return window (days)" type="number" error={errors.returnWindowDays?.message} {...register('returnWindowDays')} />
              <Textarea label="Return policy summary" rows={3} hint="Shown on product pages" error={errors.returnPolicy?.message} {...register('returnPolicy')} />
            </div>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Social links</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {['instagram', 'facebook', 'twitter', 'youtube'].map((k) => (
                <Input key={k} label={k[0].toUpperCase() + k.slice(1)} placeholder="https://" error={errors[k]?.message} {...register(k)} />
              ))}
            </div>
          </section>
          <section className="card p-6">
            <h2 className="font-bold">Newsletter & reviews</h2>
            <div className="mt-4 space-y-4">
              <Controller control={control} name="newsletterEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Newsletter signup" description="Show the newsletter form in the footer and on the homepage." />} />
              <Controller control={control} name="reviewsRequireApproval" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Require approval" description="New reviews stay hidden until an admin approves them." />} />
            </div>
          </section>
        </div>
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="card p-6">
            <h2 className="font-bold">Integrations</h2>
            <p className="mt-0.5 text-xs text-muted">Configured through server environment variables. Secrets are never exposed here.</p>
            <ul className="mt-4 space-y-2">
              <Integration ok={i.payments} label="Razorpay payments" detail={i.payments ? 'Checkout is live' : 'Add RAZORPAY_KEY_ID / SECRET (test keys are free)'} />
              <Integration ok={i.webhook} label="Razorpay webhook" detail={i.webhook ? 'Signature verification enabled' : 'Add RAZORPAY_WEBHOOK_SECRET'} />
              <Integration ok label="Image uploads" detail={i.uploads === 'cloudinary' ? 'Cloudinary with auto-optimisation' : 'Local server storage (free). Add Cloudinary for a CDN.'} />
              <Integration ok={i.smtp} label="Email (SMTP)" detail={i.smtp ? 'Transactional emails are sent' : 'Emails are logged to the server console'} />
            </ul>
          </section>
          <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!isDirty} leftIcon={<Save className="h-4 w-4" />}>
            Save settings
          </Button>
        </div>
      </form>
    </AdminPage>
  );
}
