import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, BadgePercent, Pencil, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { couponApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useConfirm } from '@/contexts/ConfirmContext';
import { couponSchema } from '@/validators/schemas';
import { AdminPage } from '@/components/admin/AdminUI';
import { Input, Select, Switch } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatPrice, formatDate } from '@/utils/format';

const STATE_TONE = { active: 'success', expired: 'neutral', exhausted: 'warning', inactive: 'neutral', scheduled: 'info' };
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function CouponForm({ initial, onDone }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: initial?.code || '',
      description: initial?.description || '',
      discountType: initial?.discountType || 'percentage',
      discountValue: initial?.discountValue ?? 10,
      minimumOrderAmount: initial?.minimumOrderAmount ?? 0,
      maximumDiscount: initial?.maximumDiscount ?? '',
      expiryDate: toDateInput(initial?.expiryDate) || toDateInput(Date.now() + 30 * 86400000),
      usageLimit: initial?.usageLimit ?? '',
      perUserLimit: initial?.perUserLimit ?? 1,
      isActive: initial?.isActive ?? true,
    },
  });
  const save = useMutation({
    mutationFn: (v) => {
      const body = { ...v, maximumDiscount: v.maximumDiscount === '' ? null : v.maximumDiscount, usageLimit: v.usageLimit === '' ? null : v.usageLimit, expiryDate: new Date(`${v.expiryDate}T23:59:59`).toISOString() };
      return initial?._id ? couponApi.update(initial._id, body) : couponApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      onDone();
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  const type = watch('discountType');
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Input label="Code" required className="uppercase" error={errors.code?.message} {...register('code')} />
      <Input label="Description" optional error={errors.description?.message} {...register('description')} />
      <Select label="Discount type" options={[{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed amount (₹)' }]} {...register('discountType')} />
      <Input label={type === 'percentage' ? 'Discount (%)' : 'Discount (₹)'} type="number" required error={errors.discountValue?.message} {...register('discountValue')} />
      <Input label="Minimum order (₹)" type="number" error={errors.minimumOrderAmount?.message} {...register('minimumOrderAmount')} />
      <Input label="Maximum discount (₹)" type="number" optional hint="Caps percentage discounts" error={errors.maximumDiscount?.message} {...register('maximumDiscount')} />
      <Input label="Expiry date" type="date" required error={errors.expiryDate?.message} {...register('expiryDate')} />
      <Input label="Total usage limit" type="number" optional hint="Empty = unlimited" error={errors.usageLimit?.message} {...register('usageLimit')} />
      <Input label="Uses per customer" type="number" error={errors.perUserLimit?.message} {...register('perUserLimit')} />
      <div className="flex items-end pb-2">
        <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" />} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {initial?._id ? 'Save coupon' : 'Create coupon'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => couponApi.list({ limit: 100 }) });
  const remove = useMutation({ mutationFn: couponApi.remove, onSuccess: () => (toast.success('Coupon deleted'), queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })), onError: (e) => toast.error(getErrorMessage(e)) });

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard?.writeText(c.code);
              toast.success(`${c.code} copied`);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand/50 bg-brand-soft/60 px-2 py-1 font-mono text-sm font-bold text-brand-dark"
          >
            {c.code} <Copy className="h-3 w-3" />
          </button>
          <p className="mt-1 text-xs text-muted">{c.description}</p>
        </div>
      ),
    },
    { key: 'value', header: 'Discount', render: (c) => <b>{c.discountType === 'percentage' ? `${c.discountValue}%` : formatPrice(c.discountValue)}</b> },
    { key: 'min', header: 'Min. order', render: (c) => formatPrice(c.minimumOrderAmount), hideOnMobile: true },
    { key: 'usage', header: 'Used', render: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
    { key: 'expiry', header: 'Expires', render: (c) => formatDate(c.expiryDate) },
    { key: 'state', header: 'Status', render: (c) => <Badge tone={STATE_TONE[c.state]}>{c.state}</Badge> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setEditing(c)} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={`Edit ${c.code}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={async () => {
              if (await confirm({ title: `Delete ${c.code}?`, description: 'Carts using this coupon will have it removed.', confirmText: 'Delete', tone: 'danger' })) remove.mutate(c._id);
            }}
            className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
            aria-label={`Delete ${c.code}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminPage title="Coupons" description="Discounts are validated and calculated on the server at checkout." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New coupon</Button>}>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable columns={columns} rows={data?.items || []} loading={isLoading} onRowClick={setEditing} empty={<EmptyState icon={BadgePercent} title="No coupons yet" action={<Button onClick={() => setEditing({})}>Create a coupon</Button>} />} />
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.code}` : 'New coupon'} size="lg">
        {editing && <CouponForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </AdminPage>
  );
}
