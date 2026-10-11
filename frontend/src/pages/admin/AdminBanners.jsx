import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { bannerSchema } from '@/validators/schemas';
import { AdminPage, ImageUploader } from '@/components/admin/AdminUI';
import { Input, Select, Switch } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { cn } from '@/utils/cn';

function BannerForm({ initial, onDone }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState(initial?.image?.url ? [initial.image] : []);
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      title: initial?.title || '',
      subtitle: initial?.subtitle || '',
      eyebrow: initial?.eyebrow || '',
      ctaText: initial?.ctaText || 'Shop now',
      ctaLink: initial?.ctaLink || '/products',
      placement: initial?.placement || 'promo',
      theme: initial?.theme || 'dark',
      sortOrder: initial?.sortOrder ?? 0,
      isActive: initial?.isActive ?? true,
    },
  });
  const save = useMutation({
    mutationFn: (v) => {
      const body = { ...v, image: image[0] ? { url: image[0].url, publicId: image[0].publicId } : null };
      return initial?._id ? adminApi.updateBanner(initial._id, body) : adminApi.createBanner(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      onDone();
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Input className="sm:col-span-2" label="Title" required error={errors.title?.message} {...register('title')} />
      <Input className="sm:col-span-2" label="Subtitle" optional error={errors.subtitle?.message} {...register('subtitle')} />
      <Input label="Eyebrow" optional placeholder="Limited drop" {...register('eyebrow')} />
      <Input label="Button text" {...register('ctaText')} />
      <Input className="sm:col-span-2" label="Button link" hint="A site path like /products?category=tumblers or an https:// URL" error={errors.ctaLink?.message} {...register('ctaLink')} />
      <Select label="Placement" options={[{ value: 'promo', label: 'Homepage promo' }, { value: 'hero', label: 'Hero' }, { value: 'announcement', label: 'Announcement' }]} {...register('placement')} />
      <Select label="Theme" options={[{ value: 'dark', label: 'Dark' }, { value: 'accent', label: 'Brand purple' }, { value: 'light', label: 'Light' }]} {...register('theme')} />
      <div className="sm:col-span-2">
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Background image</p>
        <div className="w-44">
          <ImageUploader value={image} onChange={setImage} folder="banners" single />
        </div>
      </div>
      <Input label="Sort order" type="number" {...register('sortOrder')} />
      <div className="flex items-end pb-2">
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" description="Show on the homepage" />} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {initial?._id ? 'Save banner' : 'Create banner'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminBanners() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'banners'], queryFn: adminApi.banners });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    queryClient.invalidateQueries({ queryKey: ['banners'] });
  };
  const toggle = useMutation({ mutationFn: (b) => adminApi.updateBanner(b._id, { isActive: !b.isActive }), onSuccess: () => (toast.success('Banner updated'), invalidate()) });
  const remove = useMutation({ mutationFn: adminApi.deleteBanner, onSuccess: () => (toast.success('Banner deleted'), invalidate()), onError: (e) => toast.error(getErrorMessage(e)) });
  const themes = { dark: 'bg-ink text-white', accent: 'bg-brand text-white', light: 'bg-brand-soft text-ink' };

  return (
    <AdminPage title="Banners" description="Control the promotional banners on the homepage." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New banner</Button>}>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : !data.length ? (
        <EmptyState icon={ImageIcon} title="No banners yet" description="Create a banner to promote a sale or collection." action={<Button onClick={() => setEditing({})}>Create banner</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((b) => (
            <article key={b._id} className="card overflow-hidden">
              <div className={cn('relative flex h-44 items-end overflow-hidden p-5', themes[b.theme])}>
                {b.image?.url && <img src={b.image.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                <div className="relative">
                  {b.eyebrow && <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">{b.eyebrow}</p>}
                  <p className="text-2xl font-extrabold tracking-tight">{b.title}</p>
                  <p className="line-clamp-1 text-sm opacity-75">{b.subtitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-4">
                <Badge tone={b.isActive ? 'success' : 'neutral'} dot>
                  {b.isActive ? 'Live' : 'Hidden'}
                </Badge>
                <Badge>{b.placement}</Badge>
                <span className="truncate text-xs text-muted">→ {b.ctaLink}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => toggle.mutate(b)}>
                    {b.isActive ? 'Hide' : 'Publish'}
                  </Button>
                  <button onClick={() => setEditing(b)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label="Edit banner">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this banner?', confirmText: 'Delete', tone: 'danger' })) remove.mutate(b._id);
                    }}
                    className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label="Delete banner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit banner' : 'New banner'} size="lg">
        {editing && <BannerForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </AdminPage>
  );
}
