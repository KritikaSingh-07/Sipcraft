import { forwardRef, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

const fieldBase =
  'w-full rounded-2xl border bg-surface px-4 text-[15px] text-ink placeholder:text-subtle transition-[border-color,box-shadow] duration-200 outline-none focus:border-ink focus:ring-4 focus:ring-ink/5 disabled:bg-sand disabled:text-muted';

/** Label + control + hint/error wrapper with proper aria wiring. */
export function Field({ label, error, hint, required, children, className, id: idProp, optional }) {
  const autoId = useId();
  const id = idProp || autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
          {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, optional, className, inputClassName, leftIcon, rightSlot, type = 'text', ...props }, ref) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className} id={props.id}>
      {(a11y) => (
        <div className="relative">
          {leftIcon && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-subtle">{leftIcon}</span>}
          <input
            ref={ref}
            type={isPassword && show ? 'text' : type}
            className={cn(fieldBase, 'h-12', leftIcon && 'pl-11', (isPassword || rightSlot) && 'pr-12', error ? 'border-danger' : 'border-line-strong', inputClassName)}
            required={required}
            {...a11y}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {rightSlot && <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span>}
        </div>
      )}
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, optional, className, rows = 4, ...props }, ref) {
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className} id={props.id}>
      {(a11y) => <textarea ref={ref} rows={rows} className={cn(fieldBase, 'resize-y py-3 leading-6', error ? 'border-danger' : 'border-line-strong')} {...a11y} {...props} />}
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, optional, className, options = [], placeholder, selectClassName, ...props }, ref) {
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className} id={props.id}>
      {(a11y) => (
        <div className="relative">
          <select ref={ref} className={cn(fieldBase, 'h-12 appearance-none pr-10', error ? 'border-danger' : 'border-line-strong', selectClassName)} {...a11y} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        </div>
      )}
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, description, className, ...props }, ref) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-3', className)}>
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line-strong bg-surface transition peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
        <svg viewBox="0 0 12 10" className="h-2.5 w-2.5 text-white" fill="none" aria-hidden>
          <path d="M1 5.2 4.2 8.4 11 1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-sm leading-5">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-muted">{description}</span>}
      </span>
    </label>
  );
});

export function Switch({ checked, onChange, label, description, disabled, id }) {
  const autoId = useId();
  const sid = id || autoId;
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <label htmlFor={sid} className="cursor-pointer text-sm">
          <span className="font-semibold text-ink">{label}</span>
          {description && <span className="block text-muted">{description}</span>}
        </label>
      )}
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-ink' : 'bg-line-strong', disabled && 'opacity-50')}
      >
        <span className={cn('absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}
