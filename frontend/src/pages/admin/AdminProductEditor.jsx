import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { productApi } from '@/api/endpoints';
import { getErrorMessage, applyServerErrors } from '@/api/client';
import { useCategories } from '@/hooks/queries';
import { useConfirm } from '@/contexts/ConfirmContext';
import { productSchema } from '@/validators/schemas';
import { AdminPage, ImageUploader, ListInput } from '@/components/admin/AdminUI';
import { Input, Textarea, Select, Switch } from '@/components/ui/Form';
import { FullPageLoader, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';

const EMPTY = {
  name: '',
  slug: '',
  sku: '',
  brand: 'Sipcraft',
  category: '',
  shortDescription: '',
  description: '',
  price: '',
  mrp: '',
  stock: 0,
  lowStockThreshold: 5,
  capacity: '',
  material: '',
  shippingInfo: '',
  returnInfo: '',
  colors: [],
  sizes: [],
  features: [],
  careInstructions: [],
  tags: [],
  specifications: [],
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: true,
  isActive: true,
};

function Section({ title, description, children }) {
  return (
    <section className="card p-6">
      <h2 className="font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AdminProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: product, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => productApi.adminGet(id), enabled: !isNew });
  const [images, setImages] = useState([]);

  const { register, handleSubmit, control, reset, watch, setError, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(productSchema), defaultValues: EMPTY });
  const colors = useFieldArray({ control, name: 'colors' });
  const specs = useFieldArray({ control, name: 'specifications' });

  useEffect(() => {
    if (product) {
      reset({ ...EMPTY, ...product, category: product.category?._id || product.category, colors: product.colors.map((c) => ({ name: c.name, hex: c.hex || '#cccccc' })) });
      setImages(product.images.map(({ url, publicId, alt }) => ({ url, publicId, alt })));
    }
  }, [product, reset]);

  const save = useMutation({
    mutationFn: (body) => (isNew ? productApi.create(body) : productApi.update(id, body)),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'product', id] });
      if (isNew) navigate(`/admin/products/${res.data._id}`, { replace: true });
    },
    onError: (err) => !applyServerErrors(err, setError) && toast.error(getErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => productApi.remove(id),
    onSuccess: () => {
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      navigate('/admin/products');
    },
  });

  if (!isNew && isLoading) return <FullPageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const price = Number(watch('price')) || 0;
  const mrp = Number(watch('mrp')) || 0;
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const onSubmit = (values) => {
    const body = { ...values, images, slug: values.slug || undefined };
    Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
    save.mutate(body);
  };

  return (
    <AdminPage
      title={isNew ? 'New product' : product?.name}
      description={isNew ? 'Add a product to the catalogue.' : `SKU ${product?.sku} · ${product?.soldCount} sold`}
      actions={
        <>
          <Button to="/admin/products" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
          {!isNew && (
            <Button href={`/products/${product.slug}`} target="_blank" rel="noreferrer" variant="secondary" size="sm" leftIcon={<ExternalLink className="h-4 w-4" />}>
              View in store
            </Button>
          )}
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input className="sm:col-span-2" label="Product name" required error={errors.name?.message} {...register('name')} />
              <Input label="SKU" required error={errors.sku?.message} {...register('sku')} />
              <Input label="URL slug" optional hint="Auto-generated from the name if empty" error={errors.slug?.message} {...register('slug')} />
              <Select label="Category" required placeholder="Choose a category" options={categories.map((c) => ({ value: c._id, label: c.name }))} error={errors.category?.message} {...register('category')} />
              <Input label="Brand" error={errors.brand?.message} {...register('brand')} />
              <Textarea className="sm:col-span-2" label="Short description" rows={2} hint="Shown on product cards and in search results" error={errors.shortDescription?.message} {...register('shortDescription')} />
              <Textarea className="sm:col-span-2" label="Description" rows={7} required error={errors.description?.message} {...register('description')} />
            </div>
          </Section>

          <Section title="Images" description="JPG, PNG, WEBP or AVIF up to 5 MB. Stored on Cloudinary if configured, otherwise on the server (free).">
            <ImageUploader value={images} onChange={setImages} folder="products" max={12} />
          </Section>

          <Section title="Variants">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">Colours</p>
            <div className="space-y-2">
              {colors.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Controller
                    control={control}
                    name={`colors.${i}.hex`}
                    render={({ field }) => <input type="color" value={field.value} onChange={field.onChange} className="h-12 w-12 shrink-0 cursor-pointer rounded-2xl border border-line-strong bg-surface p-1" aria-label="Colour swatch" />}
                  />
                  <Input className="flex-1" placeholder="Colour name, e.g. Lavender Haze" error={errors.colors?.[i]?.name?.message} {...register(`colors.${i}.name`)} />
                  <Input className="w-32" placeholder="#RRGGBB" error={errors.colors?.[i]?.hex?.message} {...register(`colors.${i}.hex`)} />
                  <button type="button" onClick={() => colors.remove(i)} className="mt-1 rounded-full p-2.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove colour">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" className="mt-3" leftIcon={<Plus className="h-4 w-4" />} onClick={() => colors.append({ name: '', hex: '#B9A8E8' })}>
              Add colour
            </Button>
            <div className="mt-6">
              <Controller control={control} name="sizes" render={({ field }) => <ListInput label="Sizes" value={field.value} onChange={field.onChange} placeholder="e.g. 900 ml — press Enter" />} />
            </div>
          </Section>

          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Capacity" placeholder="1.2 L (40 oz)" {...register('capacity')} />
              <Input label="Material" placeholder="18/8 stainless steel" {...register('material')} />
            </div>
            <div className="mt-5 space-y-5">
              <Controller control={control} name="features" render={({ field }) => <ListInput label="Features" value={field.value} onChange={field.onChange} placeholder="Add a feature and press Enter" />} />
              <Controller control={control} name="careInstructions" render={({ field }) => <ListInput label="Care instructions" value={field.value} onChange={field.onChange} placeholder="Add an instruction and press Enter" />} />
              <Controller control={control} name="tags" render={({ field }) => <ListInput label="Tags" value={field.value} onChange={field.onChange} placeholder="tumbler, coffee…" hint="Tags improve search results." />} />
            </div>
            <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Specifications</p>
            <div className="space-y-2">
              {specs.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Input className="flex-1" placeholder="Height" error={errors.specifications?.[i]?.key?.message} {...register(`specifications.${i}.key`)} />
                  <Input className="flex-1" placeholder="31 cm" error={errors.specifications?.[i]?.value?.message} {...register(`specifications.${i}.value`)} />
                  <button type="button" onClick={() => specs.remove(i)} className="mt-1 rounded-full p-2.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove specification">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" className="mt-3" leftIcon={<Plus className="h-4 w-4" />} onClick={() => specs.append({ key: '', value: '' })}>
              Add specification
            </Button>
            <div className="mt-6 grid gap-4">
              <Textarea label="Shipping information" rows={3} {...register('shippingInfo')} />
              <Textarea label="Return information" rows={3} {...register('returnInfo')} />
            </div>
          </Section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Price (₹)" type="number" inputMode="decimal" required error={errors.price?.message} {...register('price')} />
              <Input label="MRP (₹)" type="number" inputMode="decimal" required error={errors.mrp?.message} {...register('mrp')} />
            </div>
            <p className="mt-3 text-sm text-muted">
              Discount: <b className="text-success">{discount}%</b> <span className="text-xs">(calculated automatically)</span>
            </p>
          </Section>
          <Section title="Inventory">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Stock" type="number" inputMode="numeric" error={errors.stock?.message} {...register('stock')} />
              <Input label="Low stock alert" type="number" inputMode="numeric" error={errors.lowStockThreshold?.message} {...register('lowStockThreshold')} />
            </div>
          </Section>
          <Section title="Visibility">
            <div className="space-y-4">
              {[
                ['isActive', 'Active', 'Visible in the store'],
                ['isFeatured', 'Featured', 'Shown on the homepage'],
                ['isBestSeller', 'Best seller', 'Shown in the best sellers row'],
                ['isNewArrival', 'New arrival', 'Gets a “New” badge'],
              ].map(([name, label, description]) => (
                <Controller key={name} control={control} name={name} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={label} description={description} />} />
              ))}
            </div>
          </Section>
          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" loading={save.isPending} leftIcon={<Save className="h-4 w-4" />} disabled={!isNew && !isDirty && JSON.stringify(images) === JSON.stringify(product?.images?.map(({ url, publicId, alt }) => ({ url, publicId, alt })))}>
              {isNew ? 'Create product' : 'Save changes'}
            </Button>
            {!isNew && (
              <Button
                variant="danger-soft"
                leftIcon={<Trash2 className="h-4 w-4" />}
                loading={remove.isPending}
                onClick={async () => {
                  if (await confirm({ title: `Delete ${product.name}?`, description: 'Its reviews are deleted too. Existing orders are unaffected.', confirmText: 'Delete product', tone: 'danger' })) remove.mutate();
                }}
              >
                Delete product
              </Button>
            )}
            <Link to="/admin/products" className="py-2 text-center text-sm font-semibold text-muted hover:text-ink">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </AdminPage>
  );
}
