import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Star, MessageSquare, BadgeCheck, ImagePlus, X, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { productApi, reviewApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { reviewSchema } from '@/validators/schemas';
import { RatingStars } from '@/components/ui/Commerce';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Input, Textarea, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { formatDate, initials } from '@/utils/format';
import { cn } from '@/utils/cn';

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
  return (
    <div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star className={cn('h-8 w-8 transition', (hover || value) >= n ? 'text-[#F2B33D]' : 'text-line-strong')} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-sm font-semibold text-muted">{labels[(hover || value) - 1] || ''}</p>
    </div>
  );
}

function ReviewForm({ product, orders, onDone }) {
  const queryClient = useQueryClient();
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, setValue, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { orderId: orders[0]?._id || '', rating: 0, title: '', comment: '' },
  });
  const mutation = useMutation({
    mutationFn: (values) => productApi.createReview(product._id, { ...values, images }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['reviews', product._id] });
      queryClient.invalidateQueries({ queryKey: ['review-eligibility', product._id] });
      queryClient.invalidateQueries({ queryKey: ['product', product.slug] });
      onDone();
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError)) toast.error(getErrorMessage(err));
    },
  });

  const upload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const res = await reviewApi.uploadImages([...files].slice(0, 4 - images.length));
      setImages((imgs) => [...imgs, ...res].slice(0, 4));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5" noValidate>
      <div>
        <StarInput value={watch('rating')} onChange={(n) => setValue('rating', n, { shouldValidate: true })} />
        {errors.rating && <p className="text-[13px] font-medium text-danger">{errors.rating.message}</p>}
      </div>
      {orders.length > 1 && (
        <Select label="Order" options={orders.map((o) => ({ value: o._id, label: `${o.orderNumber} · ${formatDate(o.createdAt)}` }))} error={errors.orderId?.message} {...register('orderId')} />
      )}
      <Input label="Title" placeholder="Sum it up in a few words" optional error={errors.title?.message} {...register('title')} />
      <Textarea label="Your review" placeholder="What did you like? How do you use it?" required rows={5} error={errors.comment?.message} {...register('comment')} />
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Photos (optional)</p>
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.url} className="relative h-20 w-20 overflow-hidden rounded-xl">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setImages((all) => all.filter((i) => i !== img))} className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white" aria-label="Remove photo">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {images.length < 4 && (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong text-muted hover:border-ink hover:text-ink">
              {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
              <span className="sr-only">Add photos</span>
            </label>
          )}
        </div>
      </div>
      <Button type="submit" fullWidth loading={mutation.isPending}>
        Submit review
      </Button>
    </form>
  );
}

export default function ReviewSection({ product, distribution = [] }) {
  const status = useAuthStore((s) => s.status);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [ratingFilter, setRatingFilter] = useState(null);
  const [writing, setWriting] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const userId = useAuthStore((s) => s.user?._id);
  const report = useMutation({
    mutationFn: () => reviewApi.report(reporting._id, reportReason),
    onSuccess: (res) => {
      toast.success(res.message);
      setReporting(null);
      setReportReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', product._id, page, sort, ratingFilter],
    queryFn: () => productApi.reviews(product._id, { page, limit: 6, sort, rating: ratingFilter || undefined }),
  });
  const { data: eligibility } = useQuery({
    queryKey: ['review-eligibility', product._id],
    queryFn: () => productApi.reviewEligibility(product._id),
    enabled: status === 'authenticated',
  });
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const eligibleOrders = eligibility?.eligibleOrders || [];

  return (
    <section id="reviews" className="scroll-mt-28" aria-labelledby="reviews-h">
      <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
        <div>
          <h2 id="reviews-h" className="display text-4xl">
            Reviews
          </h2>
          <div className="mt-6 flex items-end gap-3">
            <span className="text-6xl font-extrabold tracking-tight">{product.reviewCount ? Number(product.rating).toFixed(1) : '–'}</span>
            <div className="pb-2">
              <RatingStars rating={product.rating} size={16} />
              <p className="mt-1 text-sm text-muted">{product.reviewCount} verified review{product.reviewCount === 1 ? '' : 's'}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2">
            {distribution.map((d) => {
              const pct = total ? (d.count / total) * 100 : 0;
              const active = ratingFilter === d.rating;
              return (
                <li key={d.rating}>
                  <button
                    onClick={() => {
                      setRatingFilter(active ? null : d.rating);
                      setPage(1);
                    }}
                    disabled={!d.count}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-1 py-1 text-sm transition enabled:hover:bg-sand disabled:opacity-50', active && 'bg-sand')}
                    aria-pressed={active}
                    aria-label={`${d.rating} stars: ${d.count} reviews`}
                  >
                    <span className="w-3 font-semibold">{d.rating}</span>
                    <Star className="h-3.5 w-3.5 text-[#F2B33D]" fill="currentColor" strokeWidth={0} />
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                      <motion.span className="block h-full rounded-full bg-ink" initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
                    </span>
                    <span className="w-6 text-right text-muted tabular-nums">{d.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 rounded-3xl bg-sand p-5">
            {status !== 'authenticated' ? (
              <>
                <p className="text-sm font-semibold">Bought this?</p>
                <p className="mt-1 text-sm text-muted">Sign in to share your experience with other shoppers.</p>
                <Button to={`/login?redirect=/products/${product.slug}`} variant="secondary" size="sm" className="mt-4">
                  Sign in to review
                </Button>
              </>
            ) : eligibleOrders.length ? (
              <>
                <p className="text-sm font-semibold">How’s your {product.name.split(' ')[0]}?</p>
                <p className="mt-1 text-sm text-muted">Your review helps others choose with confidence.</p>
                <Button size="sm" className="mt-4" onClick={() => setWriting(true)}>
                  Write a review
                </Button>
              </>
            ) : eligibility?.alreadyReviewed ? (
              <p className="text-sm text-muted">Thanks — you’ve reviewed this product.</p>
            ) : eligibility?.hasPurchased ? (
              <p className="text-sm text-muted">You can review this product once your order is delivered.</p>
            ) : (
              <p className="text-sm text-muted">Only verified buyers can review. Reviews unlock after delivery.</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted">{data?.pagination?.total ?? 0} reviews{ratingFilter ? ` with ${ratingFilter} stars` : ''}</p>
            <label className="sr-only" htmlFor="review-sort">
              Sort reviews
            </label>
            <select
              id="review-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-full border border-line-strong bg-surface px-3 text-sm font-semibold outline-none"
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
          </div>
          {isLoading ? (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : data?.items?.length ? (
            <ul className="divide-y divide-line">
              {data.items.map((r) => (
                <li key={r._id} className="py-6 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark">{initials(r.user?.name || 'S')}</span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        {r.user?.name || 'Sipcraft customer'} <BadgeCheck className="h-4 w-4 text-success" aria-label="Verified purchase" />
                      </p>
                      <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                    </div>
                    <RatingStars rating={r.rating} size={13} className="ml-auto" />
                  </div>
                  {r.title && <p className="mt-4 font-bold">{r.title}</p>}
                  <p className="mt-1.5 text-[15px] leading-7 text-ink-soft">{r.comment}</p>
                  {status === 'authenticated' && String(r.user?._id) !== String(userId) && (
                    <button onClick={() => setReporting(r)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-subtle hover:text-danger">
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  )}
                  {r.images?.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {r.images.map((img) => (
                        <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="h-20 w-20 overflow-hidden rounded-xl">
                          <img src={img.url} alt="Customer photo" loading="lazy" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={MessageSquare} title="No reviews yet" description="Be the first to share how this one fits into your day." />
          )}
          <Pagination className="mt-8" page={page} pages={data?.pagination?.pages} onChange={setPage} />
        </div>
      </div>

      <Modal
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title="Report this review"
        description="Tell us what’s wrong — our team reviews every report."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReporting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={report.isPending} disabled={reportReason.trim().length < 3} onClick={() => report.mutate()}>
              Report review
            </Button>
          </>
        }
      >
        <Textarea label="Reason" rows={3} value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Spam, offensive language, personal information…" />
      </Modal>
      <Modal open={writing} onClose={() => setWriting(false)} title={`Review ${product.name}`} description="Verified purchase">
        <ReviewForm product={product} orders={eligibleOrders} onDone={() => setWriting(false)} />
      </Modal>
    </section>
  );
}
