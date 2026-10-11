import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Upload, X, GripVertical, ImagePlus, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { uploadApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { Skeleton } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { cn } from '@/utils/cn';

export function AdminPage({ title, description, actions, children }) {
  return (
    <PageTransition>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </PageTransition>
  );
}

export function StatCard({ label, value, icon: Icon, hint, change, loading, tone = 'bg-brand-soft text-brand' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {Icon && (
          <span className={cn('grid h-9 w-9 place-items-center rounded-xl', tone)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <p className="mt-2 text-[28px] font-extrabold tracking-tight tabular-nums">{value}</p>}
      <div className="mt-1 flex items-center gap-2 text-xs">
        {change !== undefined && change !== null && (
          <span className={cn('inline-flex items-center gap-0.5 font-bold', change >= 0 ? 'text-success' : 'text-danger')}>
            {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {change >= 0 ? '+' : ''}
            {change}%
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </motion.div>
  );
}

export function ChartCard({ title, subtitle, action, children, className, loading, height = 280 }) {
  return (
    <section className={cn('card p-5 sm:p-6', className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {loading ? <Skeleton className="w-full rounded-2xl" style={{ height }} /> : children}
    </section>
  );
}

export function Toolbar({ search, onSearch, placeholder = 'Search…', children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
      {onSearch && (
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <label className="sr-only" htmlFor="admin-search">
            {placeholder}
          </label>
          <input id="admin-search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm outline-none focus:border-ink" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">{children}</div>
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 appearance-none rounded-full border border-line-strong bg-surface pr-9 pl-4 text-sm font-semibold outline-none focus:border-ink">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-3.5 h-3 w-3 -translate-y-1/2 text-muted" viewBox="0 0 12 8" fill="none" aria-hidden>
        <path d="m1 1.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </label>
  );
}

/**
 * Multi-image uploader with drag-to-reorder. `value` is [{ url, publicId, alt }].
 * Uploads go to /api/uploads/:folder (Cloudinary or free local storage).
 */
export function ImageUploader({ value = [], onChange, folder, max = 8, single }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [over, setOver] = useState(false);

  const upload = async (files) => {
    const list = [...files].filter((f) => /image\/(jpeg|png|webp|avif)/.test(f.type));
    if (!list.length) return toast.error('Choose JPG, PNG, WEBP or AVIF images');
    if (list.some((f) => f.size > 5 * 1024 * 1024)) return toast.error('Each image must be under 5 MB');
    const room = single ? 1 : max - value.length;
    if (room <= 0) return toast.error(`You can add up to ${max} images`);
    setUploading(true);
    try {
      const uploaded = await uploadApi.upload(folder, list.slice(0, room));
      onChange(single ? uploaded.slice(0, 1) : [...value, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const move = (from, to) => {
    if (from === to || from === null) return;
    const next = [...value];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <div
            key={img.publicId || img.url}
            draggable={!single}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn('group relative aspect-square overflow-hidden rounded-2xl border border-line bg-sand', dragIndex === i && 'opacity-40')}
          >
            <img src={img.url} alt={img.alt || ''} className="h-full w-full object-cover" />
            {i === 0 && !single && <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
            {!single && (
              <span className="absolute bottom-2 left-2 grid h-7 w-7 cursor-grab place-items-center rounded-full bg-surface/90 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              {!single && i > 0 && (
                <button type="button" onClick={() => move(i, i - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-xs font-bold shadow-soft" aria-label="Move image earlier">
                  ←
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-full bg-surface/90 shadow-soft hover:text-danger" aria-label="Remove image">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(single ? value.length === 0 : value.length < max) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
            }}
            className={cn('flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center text-xs font-semibold text-muted transition', over ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong hover:border-ink hover:text-ink')}
          >
            {uploading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-ink" /> : single ? <Upload className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? 'Uploading…' : 'Upload or drop'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={!single} className="sr-only" onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
      {!single && value.length > 1 && <p className="mt-2 text-xs text-muted">Drag (or use ←) to reorder. The first image is the cover.</p>}
    </div>
  );
}

/** Small controlled list editor for string arrays (features, tags, sizes…). */
export function ListInput({ label, value = [], onChange, placeholder, hint }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || value.includes(v)) return setDraft('');
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">{label}</p>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line-strong bg-surface p-2 focus-within:border-ink">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-sand py-1 pr-1.5 pl-3 text-sm">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 hover:bg-line" aria-label={`Remove ${v}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder}
          className="h-8 min-w-[140px] flex-1 bg-transparent px-2 text-sm outline-none"
          aria-label={label}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
