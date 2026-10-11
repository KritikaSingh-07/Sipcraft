import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Plus, Trash2, Save, RotateCcw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, ImageUploader } from '@/components/admin/AdminUI';
import { Input, Textarea, Select, Switch } from '@/components/ui/Form';
import { FullPageLoader, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { cn } from '@/utils/cn';

const TABS = [
  ['home', 'Homepage', '/'],
  ['about', 'About us', '/about'],
  ['services', 'Services', '/services'],
];

const SECTION_LABELS = {
  featured: 'Featured products',
  bestSellers: 'Best sellers carousel',
  newArrivals: 'New arrivals',
  categories: 'Shop by category',
  whyUs: 'Why choose us',
  lifestyle: 'Lifestyle gallery',
  promo: 'Promotional banners',
  testimonials: 'Customer reviews',
  gallery: 'Instagram gallery',
  newsletter: 'Newsletter signup',
};

const ICONS = ['palette', 'building', 'boxes', 'pen', 'calendar', 'gift', 'truck', 'headphones', 'sparkles', 'leaf'];

function Card({ title, description, children }) {
  return (
    <section className="card p-6">
      <h2 className="font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatsEditor({ control, register, max = 4 }) {
  const stats = useFieldArray({ control, name: 'stats' });
  return (
    <div className="space-y-2">
      {stats.fields.map((f, i) => (
        <div key={f.id} className="flex gap-2">
          <Input className="w-32" placeholder="50k+" aria-label="Value" {...register(`stats.${i}.value`)} />
          <Input className="flex-1" placeholder="Happy customers" aria-label="Label" {...register(`stats.${i}.label`)} />
          <button type="button" onClick={() => stats.remove(i)} className="rounded-full p-2.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove statistic">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {stats.fields.length < max && (
        <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => stats.append({ value: '', label: '' })}>
          Add statistic
        </Button>
      )}
    </div>
  );
}

function HomeForm({ form }) {
  const { register, control, watch, setValue } = form;
  const image = watch('hero.image');
  return (
    <>
      <Card title="Hero" description="The first thing shoppers see.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Badge" {...register('hero.badge')} />
          <div />
          <Input label="Headline" {...register('hero.title')} />
          <Input label="Highlighted word(s)" hint="Shown in the accent serif font" {...register('hero.accent')} />
          <Textarea className="sm:col-span-2" label="Subtitle" rows={2} {...register('hero.subtitle')} />
          <Input label="Primary button" {...register('hero.primaryCta')} />
          <Input label="Secondary button" {...register('hero.secondaryCta')} />
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">Hero image</p>
            <div className="w-44">
              <ImageUploader value={image ? [{ url: image }] : []} onChange={(v) => setValue('hero.image', v[0]?.url || '', { shouldDirty: true })} folder="banners" single />
            </div>
          </div>
        </div>
      </Card>
      <Card title="Brand statistics" description="Shown under the hero (up to 4).">
        <StatsEditor control={control} register={register} />
      </Card>
      <Card title="Homepage sections" description="Turn sections on or off without touching code.">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(SECTION_LABELS).map(([k, label]) => (
            <Controller key={k} control={control} name={`sections.${k}`} render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label={label} />} />
          ))}
        </div>
      </Card>
      <Card title="Newsletter block">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" {...register('newsletter.title')} />
          <Input label="Highlighted text" {...register('newsletter.accent')} />
          <Textarea className="sm:col-span-2" label="Subtitle" rows={2} {...register('newsletter.subtitle')} />
        </div>
      </Card>
    </>
  );
}

function AboutForm({ form }) {
  const { register, control } = form;
  return (
    <>
      <Card title="Brand story">
        <div className="grid gap-4">
          <Input label="Headline" {...register('headline')} />
          <Textarea label="Story" rows={5} {...register('story')} />
        </div>
      </Card>
      <Card title="Mission, vision & promises">
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea label="Mission" rows={3} {...register('mission')} />
          <Textarea label="Vision" rows={3} {...register('vision')} />
          <Textarea label="Sustainability" rows={4} {...register('sustainability')} />
          <Textarea label="Quality promise" rows={4} {...register('qualityPromise')} />
        </div>
      </Card>
      <Card title="Brand statistics">
        <StatsEditor control={control} register={register} />
      </Card>
    </>
  );
}

function ServicesForm({ form }) {
  const { register, control } = form;
  const items = useFieldArray({ control, name: 'items' });
  return (
    <>
      <Card title="Page header">
        <div className="grid gap-4">
          <Input label="Headline" {...register('headline')} />
          <Textarea label="Introduction" rows={2} {...register('intro')} />
        </div>
      </Card>
      <Card title="Services" description="Up to 12 service cards.">
        <div className="space-y-4">
          {items.fields.map((f, i) => (
            <div key={f.id} className="rounded-2xl border border-line p-4">
              <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                <Select label="Icon" options={ICONS.map((v) => ({ value: v, label: v }))} {...register(`items.${i}.icon`)} />
                <Input label="Title" {...register(`items.${i}.title`)} />
                <div className="flex items-end gap-2 pb-1">
                  <Controller control={control} name={`items.${i}.featured`} render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label="Featured" />} />
                  <button type="button" onClick={() => items.remove(i)} className="rounded-full p-2.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove service">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Textarea className="mt-3" label="Description" rows={2} {...register(`items.${i}.text`)} />
            </div>
          ))}
          {items.fields.length < 12 && (
            <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => items.append({ icon: 'sparkles', title: '', text: '', featured: false })}>
              Add service
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function Editor({ pageKey, path }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'content', pageKey], queryFn: () => adminApi.content(pageKey) });
  const form = useForm();
  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);
  const after = (res) => {
    toast.success(res.message);
    queryClient.setQueryData(['admin', 'content', pageKey], res.data);
    queryClient.invalidateQueries({ queryKey: ['content', pageKey] });
  };
  const save = useMutation({ mutationFn: (v) => adminApi.updateContent(pageKey, v), onSuccess: after, onError: (e) => toast.error(getErrorMessage(e)) });
  const reset = useMutation({ mutationFn: () => adminApi.resetContent(pageKey), onSuccess: after });

  if (isLoading) return <FullPageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const Form = { home: HomeForm, about: AboutForm, services: ServicesForm }[pageKey];

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-6 xl:grid-cols-[1fr_280px]" noValidate>
      <div className="space-y-6">
        <Form form={form} />
      </div>
      <div className="space-y-3 xl:sticky xl:top-24 xl:self-start">
        <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!form.formState.isDirty} leftIcon={<Save className="h-4 w-4" />}>
          Publish changes
        </Button>
        <Button href={path} target="_blank" rel="noreferrer" variant="secondary" fullWidth leftIcon={<ExternalLink className="h-4 w-4" />}>
          Preview page
        </Button>
        <Button
          variant="ghost"
          fullWidth
          leftIcon={<RotateCcw className="h-4 w-4" />}
          loading={reset.isPending}
          onClick={async () => {
            if (await confirm({ title: 'Reset to default content?', description: 'Your customisations for this page will be removed.', confirmText: 'Reset', tone: 'danger' })) reset.mutate();
          }}
        >
          Reset to defaults
        </Button>
        <p className="text-xs leading-5 text-muted">Changes go live immediately after publishing. Banners are managed under Banners; featured, best-seller and new-arrival products are set on each product.</p>
      </div>
    </form>
  );
}

export default function AdminContent() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t[0] === params.get('page')) || TABS[0];
  return (
    <AdminPage title="Content" description="Edit homepage, About us and Services content without code changes.">
      <div className="mb-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab[0] === k} onClick={() => setParams({ page: k })} className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition', tab[0] === k ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink')}>
            {label}
          </button>
        ))}
      </div>
      <Editor key={tab[0]} pageKey={tab[0]} path={tab[2]} />
    </AdminPage>
  );
}
