import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, MapPin, Home, Briefcase, Phone, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { userApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AddressForm } from '@/components/checkout/CheckoutParts';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { DashHeader } from '@/components/dashboard/DashUI';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { cn } from '@/utils/cn';

const EASE = [0.16, 1, 0.3, 1];
const labelIcon = (label = '') => (/work|office/i.test(label) ? Briefcase : /home/i.test(label) ? Home : MapPin);

function AddressTile({ a, onEdit, onDelete, onMakeDefault }) {
  const Icon = labelIcon(a.label);
  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift',
        a.isDefault ? 'border-ink/80' : 'border-line',
      )}
    >
      {/* Postmark decoration */}
      <div aria-hidden className="absolute -top-6 -right-6 grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-line-strong/70 text-subtle transition duration-700 group-hover:rotate-45">
        <MapPin className="h-5 w-5" />
      </div>
      {a.isDefault && <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand-tint to-[#e2557a]" />}

      <div className="flex items-center gap-3">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl transition', a.isDefault ? 'bg-ink text-white' : 'bg-sand text-ink group-hover:bg-ink group-hover:text-white')}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-muted uppercase">{a.label || 'Home'}</p>
          <p className="font-bold">{a.fullName}</p>
        </div>
      </div>

      <p className="mt-5 flex-1 text-sm leading-6 text-ink-soft">
        {a.address}
        {a.apartment ? `, ${a.apartment}` : ''}
        <br />
        {a.city}, {a.state} <span className="font-semibold text-ink">{a.pincode}</span>
      </p>
      {a.phone && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted">
          <Phone className="h-3.5 w-3.5" /> {a.phone}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-dashed border-line-strong pt-4">
        {a.isDefault ? (
          <span className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
            <Star className="h-3.5 w-3.5 fill-current" /> Default
          </span>
        ) : (
          <button onClick={onMakeDefault} className="mr-auto rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-sand hover:text-ink">
            Set as default
          </button>
        )}
        <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink" aria-label={`Edit ${a.label || 'address'}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${a.label || 'address'}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Addresses() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['addresses'], queryFn: userApi.addresses });
  const [editing, setEditing] = useState(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const save = useMutation({
    mutationFn: (values) => (editing?._id ? userApi.updateAddress(editing._id, values) : userApi.createAddress(values)),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: userApi.deleteAddress, onSuccess: () => (toast.success('Address deleted'), invalidate()), onError: (e) => toast.error(getErrorMessage(e)) });
  const makeDefault = useMutation({ mutationFn: userApi.setDefaultAddress, onSuccess: () => (toast.success('Default address updated'), invalidate()) });

  // Default address first.
  const list = [...(data || [])].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));

  return (
    <PageTransition>
      <Seo title="Addresses" noindex />
      <DashHeader
        icon={MapPin}
        eyebrow="Address book"
        title="Where should we"
        accent="deliver?"
        description="Save home, work and gifting addresses for a one-tap checkout."
        action={
          data?.length > 0 && (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>
              Add address
            </Button>
          )
        }
      />
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-[1.75rem]" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.length ? (
          <EmptyState icon={MapPin} title="No saved addresses" description="Save an address for faster checkout next time." action={<Button onClick={() => setEditing({})}>Add your first address</Button>} />
        ) : (
          <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((a, i) => (
                <motion.div key={a._id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}>
                  <AddressTile
                    a={a}
                    onEdit={() => setEditing(a)}
                    onMakeDefault={() => makeDefault.mutate(a._id)}
                    onDelete={async () => {
                      if (await confirm({ title: 'Delete this address?', description: `${a.address}, ${a.city}`, confirmText: 'Delete', tone: 'danger' })) remove.mutate(a._id);
                    }}
                  />
                </motion.div>
              ))}
              <motion.button
                key="add"
                layout
                type="button"
                onClick={() => setEditing({})}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group grid min-h-[260px] place-items-center rounded-[1.75rem] border-2 border-dashed border-line-strong p-6 text-center transition hover:border-brand hover:bg-brand-soft/40"
              >
                <span>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sand text-ink transition duration-500 group-hover:rotate-90 group-hover:bg-brand group-hover:text-white">
                    <Plus className="h-6 w-6" />
                  </span>
                  <span className="mt-4 block font-bold">Add a new address</span>
                  <span className="mt-1 block text-sm text-muted">Home, office or a friend’s place</span>
                </span>
              </motion.button>
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit address' : 'New address'} size="lg">
        <AddressForm initial={editing?._id ? editing : { isDefault: !data?.length }} onSubmit={(v) => save.mutateAsync(v)} onCancel={() => setEditing(null)} submitting={save.isPending} />
      </Modal>
    </PageTransition>
  );
}
