import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tag, X, MapPin, Pencil, Trash2, Star, Check, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { addressSchema } from '@/validators/schemas';
import { Input, Select, Checkbox } from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';
import { INDIAN_STATES } from '@/utils/constants';
import { cn } from '@/utils/cn';

/** Order summary with server-computed totals. */
export function CheckoutSummary({ totals, items = [], compact, children, title = 'Order summary' }) {
  if (!totals) return null;
  const row = (label, value, opts = {}) => (
    <div className={cn('flex items-center justify-between text-sm', opts.className)}>
      <dt className={opts.muted === false ? '' : 'text-muted'}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return (
    <section className="card p-6" aria-label={title}>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {!compact && items.length > 0 && (
        <ul className="mt-5 space-y-4 border-b border-line pb-5">
          {items.map((i) => (
            <li key={i._id} className="flex items-center gap-3">
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-sand">
                <img src={i.product?.image} alt="" className="h-full w-full object-cover" />
                <span className="absolute -top-0 -right-0 grid h-5 min-w-5 place-items-center rounded-bl-lg bg-ink px-1 text-[10px] font-bold text-white">{i.quantity}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{i.product?.name}</p>
                <p className="text-xs text-muted">{[i.color, i.size].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-5 space-y-3">
        {row(`Subtotal (${totals.itemCount} item${totals.itemCount === 1 ? '' : 's'})`, formatPrice(totals.subtotal))}
        {totals.mrpTotal > totals.subtotal && row('Product savings', `− ${formatPrice(totals.mrpTotal - totals.subtotal)}`, { className: 'text-success' })}
        {totals.discount > 0 && row(`Coupon${totals.coupon?.code ? ` (${totals.coupon.code})` : ''}`, `− ${formatPrice(totals.discount)}`, { className: 'text-success' })}
        {row('Shipping', totals.shippingFee ? formatPrice(totals.shippingFee) : <span className="text-success">Free</span>)}
        {row(
          <span className="inline-flex items-center gap-1">
            GST included <span title={`Prices include ${totals.taxRate}% GST`}><Info className="h-3.5 w-3.5" aria-hidden /></span>
          </span>,
          formatPrice(totals.tax),
        )}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
        <span className="font-bold">Total</span>
        <span className="text-2xl font-extrabold tracking-tight tabular-nums">{formatPrice(totals.total)}</span>
      </div>
      {totals.savings > 0 && <p className="mt-2 text-right text-[13px] font-semibold text-success">You save {formatPrice(totals.savings)} on this order</p>}
      {children}
    </section>
  );
}

export function CouponInput({ appliedCode, onApply, onRemove, applying, disabled, disabledHint, suggestions = [] }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const apply = async (value) => {
    const c = (value ?? code).trim();
    if (!c) return setError('Enter a coupon code');
    setError('');
    try {
      await onApply(c.toUpperCase());
      setCode('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-success bg-success-soft px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-success">
          <Tag className="h-4 w-4" /> {appliedCode} applied
        </span>
        <button onClick={onRemove} className="rounded-full p-1 text-success hover:bg-white/60" aria-label="Remove coupon">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            id="coupon"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            disabled={disabled}
            placeholder="Coupon code"
            className={cn('h-12 w-full rounded-full border bg-surface pr-4 pl-11 text-sm font-semibold tracking-wider uppercase outline-none placeholder:tracking-normal placeholder:normal-case focus:border-ink disabled:bg-sand', error ? 'border-danger' : 'border-line-strong')}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'coupon-error' : undefined}
          />
        </div>
        <Button type="submit" variant="secondary" loading={applying} disabled={disabled}>
          Apply
        </Button>
      </form>
      {error && (
        <p id="coupon-error" role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      {disabled && disabledHint && <p className="mt-2 text-[13px] text-muted">{disabledHint}</p>}
      {!disabled && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s.code} type="button" onClick={() => apply(s.code)} className="rounded-full border border-dashed border-brand/50 bg-brand-soft/60 px-3 py-1 text-xs font-semibold text-brand-dark hover:bg-brand-soft" title={s.description}>
              {s.code} · {s.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyAddress = { label: 'Home', fullName: '', phone: '', email: '', address: '', apartment: '', city: '', state: '', pincode: '', country: 'India', isDefault: false };

export function AddressForm({ initial, onSubmit, onCancel, submitting, submitLabel = 'Save address', showDefault = true }) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm({ resolver: zodResolver(addressSchema), defaultValues: { ...emptyAddress, ...initial } });
  useEffect(() => reset({ ...emptyAddress, ...initial }), [initial, reset]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch (err) {
          if (!applyServerErrors(err, setError)) toast.error(getErrorMessage(err));
        }
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Input label="Full name" autoComplete="name" required error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Phone" type="tel" autoComplete="tel" inputMode="tel" required error={errors.phone?.message} {...register('phone')} />
      <Input className="sm:col-span-2" label="Address" autoComplete="address-line1" placeholder="House no., street, area" required error={errors.address?.message} {...register('address')} />
      <Input className="sm:col-span-2" label="Apartment, suite, landmark" autoComplete="address-line2" optional error={errors.apartment?.message} {...register('apartment')} />
      <Input label="City" autoComplete="address-level2" required error={errors.city?.message} {...register('city')} />
      <Select label="State" required placeholder="Select state" options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} error={errors.state?.message} autoComplete="address-level1" {...register('state')} />
      <Input label="Pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" required error={errors.pincode?.message} {...register('pincode')} />
      <Input label="Country" autoComplete="country-name" readOnly error={errors.country?.message} {...register('country')} hint="We currently ship within India" />
      <Select label="Save as" options={['Home', 'Work', 'Other'].map((v) => ({ value: v, label: v }))} {...register('label')} />
      {showDefault && (
        <div className="flex items-end pb-3">
          <Checkbox label="Set as default address" {...register('isDefault')} />
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function AddressCard({ address, selected, onSelect, onEdit, onDelete, onMakeDefault, selectable }) {
  const Wrapper = selectable ? 'button' : 'div';
  return (
    <Wrapper
      type={selectable ? 'button' : undefined}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        'relative w-full rounded-3xl border p-5 text-left transition',
        selected ? 'border-ink bg-surface shadow-soft ring-1 ring-ink' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', selected ? 'bg-ink text-white' : 'bg-sand text-ink')}>
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {address.fullName}
            <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">{address.label || 'Home'}</span>
            {address.isDefault && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-dark uppercase">Default</span>}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {address.address}
            {address.apartment ? `, ${address.apartment}` : ''}
            <br />
            {address.city}, {address.state} {address.pincode}
            <br />
            {address.phone}
          </p>
        </div>
        <AnimatePresence>
          {selected && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid h-6 w-6 place-items-center rounded-full bg-ink text-white">
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {(onEdit || onDelete || onMakeDefault) && (
        <div className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <span role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()} onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-sand">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </span>
          )}
          {onMakeDefault && !address.isDefault && (
            <span role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onMakeDefault()} onClick={onMakeDefault} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-sand">
              <Star className="h-3.5 w-3.5" /> Make default
            </span>
          )}
          {onDelete && (
            <span role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onDelete()} onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
}
