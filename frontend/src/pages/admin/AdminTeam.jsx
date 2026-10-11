import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, UsersRound, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { teamSchema } from '@/validators/schemas';
import { AdminPage, ImageUploader } from '@/components/admin/AdminUI';
import { Input, Textarea, Switch } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { initials } from '@/utils/format';

function MemberForm({ initial, onDone }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState(initial?.image?.url ? [initial.image] : []);
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: initial?.name || '',
      position: initial?.position || '',
      bio: initial?.bio || '',
      linkedin: initial?.socials?.linkedin || '',
      instagram: initial?.socials?.instagram || '',
      twitter: initial?.socials?.twitter || '',
      sortOrder: initial?.sortOrder ?? 0,
      isActive: initial?.isActive ?? true,
    },
  });
  const save = useMutation({
    mutationFn: ({ linkedin, instagram, twitter, ...v }) => {
      const body = { ...v, socials: { linkedin, instagram, twitter }, image: image[0] ? { url: image[0].url, publicId: image[0].publicId } : null };
      return initial?._id ? adminApi.updateTeam(initial._id, body) : adminApi.createTeam(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      onDone();
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Photo</p>
        <div className="w-36">
          <ImageUploader value={image} onChange={setImage} folder="team" single />
        </div>
      </div>
      <Input label="Name" required error={errors.name?.message} {...register('name')} />
      <Input label="Position" required error={errors.position?.message} {...register('position')} />
      <Textarea className="sm:col-span-2" label="Bio" rows={3} error={errors.bio?.message} {...register('bio')} />
      <Input label="LinkedIn URL" optional error={errors.linkedin?.message} {...register('linkedin')} />
      <Input label="Instagram URL" optional error={errors.instagram?.message} {...register('instagram')} />
      <Input label="X / Twitter URL" optional error={errors.twitter?.message} {...register('twitter')} />
      <Input label="Sort order" type="number" {...register('sortOrder')} />
      <div className="sm:col-span-2">
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Visible on the Team page" />} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {initial?._id ? 'Save member' : 'Add member'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminTeam() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'team'], queryFn: adminApi.team });
  const remove = useMutation({
    mutationFn: adminApi.deleteTeam,
    onSuccess: () => {
      toast.success('Team member removed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <AdminPage title="Team" description="People shown on the public Team page." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Add member</Button>}>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : !data.length ? (
        <EmptyState icon={UsersRound} title="No team members" action={<Button onClick={() => setEditing({})}>Add the first member</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((m) => (
            <article key={m._id} className="card flex items-center gap-4 p-4">
              {m.image?.url ? <img src={m.image.url} alt="" className="h-20 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="grid h-20 w-16 shrink-0 place-items-center rounded-2xl bg-sand font-bold">{initials(m.name)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.name}</p>
                <p className="truncate text-sm text-muted">{m.position}</p>
                {!m.isActive && <Badge className="mt-1">Hidden</Badge>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEditing(m)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={`Edit ${m.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({ title: `Remove ${m.name}?`, confirmText: 'Remove', tone: 'danger' })) remove.mutate(m._id);
                  }}
                  className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.name}` : 'New team member'} size="lg">
        {editing && <MemberForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </AdminPage>
  );
}
