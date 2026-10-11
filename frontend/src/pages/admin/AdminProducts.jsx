import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Package, Trash2, Eye, EyeOff, Star, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { productApi } from '@/api/endpoints';
import { getErrorMessage } from '@/api/client';
import { useCategories } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AdminPage, Toolbar, FilterSelect } from '@/components/admin/AdminUI';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback';
import Button from '@/components/ui/Button';
import { formatPrice, formatNumber } from '@/utils/format';

const STOCK = { in_stock: ['success', 'In stock'], low_stock: ['warning', 'Low stock'], out_of_stock: ['danger', 'Out of stock'] };

export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search, 350);
  const [selected, setSelected] = useState([]);
  const q = {
    search: debounced,
    category: params.get('category') || '',
    status: params.get('status') || 'all',
    stock: params.get('stock') || 'all',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    limit: 15,
  };
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected([]);
  };

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'products', q], queryFn: () => productApi.adminList(q), placeholderData: keepPreviousData });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };
  const bulk = useMutation({
    mutationFn: productApi.bulk,
    onSuccess: (res) => {
      toast.success(res.message);
      setSelected([]);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: productApi.remove,
    onSuccess: () => {
      toast.success('Product deleted');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const runBulk = async (action) => {
    if (action === 'delete' && !(await confirm({ title: `Delete ${selected.length} product${selected.length === 1 ? '' : 's'}?`, description: 'This also removes their reviews. Past orders keep their own copy of product details.', confirmText: 'Delete', tone: 'danger' }))) return;
    bulk.mutate({ ids: selected, action });
  };

  const counts = data?.counts || {};
  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          <img src={p.images?.[0]?.url} alt="" className="h-12 w-10 shrink-0 rounded-lg bg-sand object-cover" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-muted">{p.sku}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => p.category?.name || '—', hideOnMobile: true },
    { key: 'price', header: 'Price', render: (p) => <span className="font-semibold tabular-nums">{formatPrice(p.price)}</span> },
    {
      key: 'stock',
      header: 'Stock',
      render: (p) => (
        <Badge tone={STOCK[p.stockStatus][0]} dot>
          {p.stock} · {STOCK[p.stockStatus][1]}
        </Badge>
      ),
    },
    { key: 'sold', header: 'Sold', render: (p) => formatNumber(p.soldCount), hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={p.isArchived ? 'dark' : p.isActive ? 'success' : 'neutral'}>{p.isArchived ? 'Archived' : p.isActive ? 'Active' : 'Hidden'}</Badge>
          {p.isFeatured && <Badge tone="brand">Featured</Badge>}
          {p.isBestSeller && <Badge tone="info">Bestseller</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={`View ${p.name} in store`}>
            <ExternalLink className="h-4 w-4" />
          </a>
          <Link to={`/admin/products/${p._id}`} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={`Edit ${p.name}`}>
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={async () => {
              if (await confirm({ title: `Delete ${p.name}?`, description: 'This cannot be undone.', confirmText: 'Delete', tone: 'danger' })) remove.mutate(p._id);
            }}
            className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
            aria-label={`Delete ${p.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminPage
      title="Products"
      description={`${counts.total ?? '–'} products · ${counts.active ?? '–'} active · ${counts.archived ?? 0} archived · ${counts.lowStock ?? 0} low stock · ${counts.outOfStock ?? 0} out of stock`}
      actions={
        <Button to="/admin/products/new" leftIcon={<Plus className="h-4 w-4" />}>
          Add product
        </Button>
      }
    >
      <Toolbar search={search} onSearch={(v) => (setSearch(v), set({ search: v }))} placeholder="Search name, SKU or tag">
        <FilterSelect label="Category" value={q.category} onChange={(v) => set({ category: v })} options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c._id, label: c.name }))]} />
        <FilterSelect label="Status" value={q.status} onChange={(v) => set({ status: v })} options={[{ value: 'all', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Hidden' }, { value: 'archived', label: 'Archived' }]} />
        <FilterSelect label="Stock" value={q.stock} onChange={(v) => set({ stock: v })} options={[{ value: 'all', label: 'Any stock' }, { value: 'in_stock', label: 'In stock' }, { value: 'low_stock', label: 'Low stock' }, { value: 'out_of_stock', label: 'Out of stock' }]} />
        <FilterSelect
          label="Sort"
          value={q.sort}
          onChange={(v) => set({ sort: v })}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'name', label: 'Name A–Z' },
            { value: 'price-low', label: 'Price ↑' },
            { value: 'price-high', label: 'Price ↓' },
            { value: 'stock-low', label: 'Stock ↑' },
            { value: 'best-selling', label: 'Best selling' },
          ]}
        />
      </Toolbar>

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-ink p-3 pl-5 text-white">
          <span className="mr-2 text-sm font-semibold">{selected.length} selected</span>
          <Button size="xs" variant="light" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => runBulk('activate')}>
            Activate
          </Button>
          <Button size="xs" variant="light" leftIcon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => runBulk('deactivate')}>
            Hide
          </Button>
          <Button size="xs" variant="light" leftIcon={<Star className="h-3.5 w-3.5" />} onClick={() => runBulk('feature')}>
            Feature
          </Button>
          <Button size="xs" variant="light" onClick={() => runBulk('unfeature')}>
            Unfeature
          </Button>
          <Button size="xs" variant="light" onClick={() => runBulk('bestseller')}>
            Mark bestseller
          </Button>
          {q.status === 'archived' ? (
            <Button size="xs" variant="light" onClick={() => runBulk('unarchive')}>
              Unarchive
            </Button>
          ) : (
            <Button size="xs" variant="light" onClick={() => runBulk('archive')}>
              Archive
            </Button>
          )}
          <Button size="xs" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => runBulk('delete')} loading={bulk.isPending}>
            Delete
          </Button>
          <button onClick={() => setSelected([])} className="ml-auto px-3 text-sm text-white/70 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={isLoading}
          selectable
          selected={selected}
          onSelect={setSelected}
          onRowClick={(p) => navigate(`/admin/products/${p._id}`)}
          empty={<EmptyState icon={Package} title="No products found" description="Try different filters or add your first product." action={<Button to="/admin/products/new">Add product</Button>} />}
        />
      )}
      <Pagination className="mt-6" page={q.page} pages={data?.pagination?.pages} onChange={(p) => set({ page: String(p) })} />
    </AdminPage>
  );
}
