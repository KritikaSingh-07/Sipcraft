import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { categoryApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { categorySchema } from '@/validators/schemas';
import { AdminPage, ImageUploader } from '@/components/admin/AdminUI';
import { Input, Textarea, Switch } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';

function CategoryForm({ initial, onDone }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState(initial?.image?.url ? [initial.image] : []);
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: initial?.name || '', slug: initial?.slug || '', description: initial?.description || '', sortOrder: initial?.sortOrder ?? 0, isActive: initial?.isActive ?? true },
  });
  const save = useMutation({
    mutationFn: (body) => (initial?._id ? categoryApi.update(initial._id, body) : categoryApi.create(body)),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      onDone();
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate({ ...v, slug: v.slug || undefined, image: image[0] ? { url: image[0].url, publicId: image[0].publicId } : null }))} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required error={errors.name?.message} {...register('name')} />
        <Input label="Slug" optional hint="Auto-generated if empty" error={errors.slug?.message} {...register('slug')} />
      </div>
      <Textarea label="Description" rows={3} error={errors.description?.message} {...register('description')} />
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Image</p>
        <div className="w-40">
          <ImageUploader value={image} onChange={setImage} folder="categories" single />
        </div>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Input label="Sort order" type="number" {...register('sortOrder')} />
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Enabled" description="Visible in the store" />} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {initial?._id ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => categoryApi.list({ all: true }) });
  const toggle = useMutation({
    mutationFn: (c) => categoryApi.update(c._id, { isActive: !c.isActive }),
    onSuccess: (res) => {
      toast.success(res.data.isActive ? 'Category enabled' : 'Category disabled');
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
  const remove = useMutation({
    mutationFn: categoryApi.remove,
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <AdminPage title="Categories" description="Organise the catalogue. Disabled categories and their products are hidden from the store." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Add category</Button>}>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : !data.length ? (
        <EmptyState icon={Layers} title="No categories yet" action={<Button onClick={() => setEditing({})}>Create the first one</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <article key={c._id} className="card flex gap-4 p-4">
              <img src={c.image?.url || '/favicon.svg'} alt="" className="h-28 w-24 shrink-0 rounded-2xl bg-sand object-cover" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-bold">{c.name}</h2>
                  <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <p className="text-xs text-muted">
                  /{c.slug} · {c.productCount} products
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                <div className="mt-auto flex gap-1 pt-2">
                  <button onClick={() => setEditing(c)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={`Edit ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggle.mutate(c)} className="rounded-full px-3 text-xs font-semibold text-muted hover:bg-sand hover:text-ink">
                    {c.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: `Delete ${c.name}?`, description: c.productCount ? 'This category still has products — move them first.' : 'This cannot be undone.', confirmText: 'Delete', tone: 'danger' })) remove.mutate(c._id);
                    }}
                    className="ml-auto rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.name}` : 'New category'} size="lg">
        {editing && <CategoryForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </AdminPage>
  );
}
