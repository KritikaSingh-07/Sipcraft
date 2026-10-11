import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Search, PackageSearch, Star, ChevronDown } from 'lucide-react';
import { productApi } from '@/api/endpoints';
import { useCategories } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProductGrid } from '@/components/product/ProductCard';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Seo from '@/components/ui/Seo';
import { Drawer } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageTransition } from '@/components/ui/Motion';
import { SORT_OPTIONS } from '@/utils/constants';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/cn';

const LIMIT = 12;
const PRICE_BANDS = [
  { label: 'Under ₹500', min: '', max: '499' },
  { label: '₹500 – ₹999', min: '500', max: '999' },
  { label: '₹1,000 – ₹1,999', min: '1000', max: '1999' },
  { label: '₹2,000 & above', min: '2000', max: '' },
];

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-bold" aria-expanded={open}>
        {title}
        <ChevronDown className={cn('h-4 w-4 text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Filters({ params, set, categories, priceRange }) {
  const selectedCats = (params.get('category') || '').split(',').filter(Boolean);
  const [min, setMin] = useState(params.get('minPrice') || '');
  const [max, setMax] = useState(params.get('maxPrice') || '');
  useEffect(() => {
    setMin(params.get('minPrice') || '');
    setMax(params.get('maxPrice') || '');
  }, [params]);

  const toggleCat = (slug) => {
    const next = selectedCats.includes(slug) ? selectedCats.filter((s) => s !== slug) : [...selectedCats, slug];
    set({ category: next.join(',') });
  };

  return (
    <div>
      <FilterSection title="Category">
        <ul className="space-y-1">
          {categories.map((c) => {
            const active = selectedCats.includes(c.slug);
            return (
              <li key={c._id}>
                <button onClick={() => toggleCat(c.slug)} className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-sand', active && 'font-semibold')} aria-pressed={active}>
                  <span className={cn('grid h-5 w-5 place-items-center rounded-md border transition', active ? 'border-ink bg-ink' : 'border-line-strong')}>
                    {active && (
                      <svg viewBox="0 0 12 10" className="h-2.5 w-2.5 text-white" fill="none" aria-hidden>
                        <path d="M1 5.2 4.2 8.4 11 1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-subtle">{c.productCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FilterSection>

      <FilterSection title="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map((b) => {
            const active = (params.get('minPrice') || '') === b.min && (params.get('maxPrice') || '') === b.max;
            return (
              <button
                key={b.label}
                onClick={() => set(active ? { minPrice: '', maxPrice: '' } : { minPrice: b.min, maxPrice: b.max })}
                className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold transition', active ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink')}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ minPrice: min, maxPrice: max });
          }}
        >
          <label className="sr-only" htmlFor="pmin">
            Minimum price
          </label>
          <input id="pmin" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder={`₹${priceRange?.min ?? 0}`} className="h-10 w-full rounded-xl border border-line-strong px-3 text-sm outline-none focus:border-ink" />
          <span className="text-muted">–</span>
          <label className="sr-only" htmlFor="pmax">
            Maximum price
          </label>
          <input id="pmax" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder={`₹${priceRange?.max ?? ''}`} className="h-10 w-full rounded-xl border border-line-strong px-3 text-sm outline-none focus:border-ink" />
          <button type="submit" className="h-10 shrink-0 rounded-xl bg-ink px-3 text-sm font-semibold text-white">
            Go
          </button>
        </form>
      </FilterSection>

      <FilterSection title="Rating">
        <div className="space-y-1">
          {[4, 3].map((r) => {
            const active = params.get('rating') === String(r);
            return (
              <button key={r} onClick={() => set({ rating: active ? '' : String(r) })} className={cn('flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-sand', active && 'bg-sand font-semibold')} aria-pressed={active}>
                <span className="flex text-[#F2B33D]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className={cn('h-4 w-4', i >= r && 'text-line-strong')} fill="currentColor" strokeWidth={0} />
                  ))}
                </span>
                & up
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Availability">
        <div className="flex gap-2">
          {[
            ['', 'All'],
            ['in_stock', 'In stock'],
          ].map(([v, l]) => (
            <button key={l} onClick={() => set({ availability: v })} className={cn('rounded-full border px-4 py-1.5 text-[13px] font-semibold transition', (params.get('availability') || '') === v ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink')}>
              {l}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const { data: categories = [] } = useCategories();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(params.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const sentinel = useRef(null);

  /** Updates URL query params; any filter change resets to page 1. */
  const set = (patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v === undefined || v === null ? next.delete(k) : next.set(k, v)));
    if (!keepPage) next.delete('page');
    setParams(next, { replace: !keepPage });
  };

  useEffect(() => {
    if ((params.get('search') || '') !== debouncedSearch) set({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => setSearch(params.get('search') || ''), [params]);

  const filters = useMemo(() => {
    const f = {};
    ['category', 'search', 'minPrice', 'maxPrice', 'rating', 'availability', 'sort', 'bestSeller', 'featured', 'newArrival', 'tag'].forEach((k) => {
      if (params.get(k)) f[k] = params.get(k);
    });
    return f;
  }, [params]);
  const page = Math.max(1, Number(params.get('page')) || 1);

  // One query path: desktop shows a single page (URL ?page=N), mobile appends pages as you scroll.
  const query = useInfiniteQuery({
    queryKey: ['products', 'list', filters, page],
    queryFn: ({ pageParam }) => productApi.list({ ...filters, page: pageParam, limit: LIMIT }),
    initialPageParam: page,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    staleTime: 60_000,
  });
  const pages = query.data?.pages || [];
  const items = pages.flatMap((p) => p.items);
  const pagination = pages[0]?.pagination;
  const priceRange = pages[0]?.priceRange;

  useEffect(() => {
    if (isDesktop || !sentinel.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [isDesktop, query]);

  const selectedCats = (filters.category || '').split(',').filter(Boolean);
  const activeChips = [
    ...selectedCats.map((slug) => ({ key: `c-${slug}`, label: categories.find((c) => c.slug === slug)?.name || slug, clear: () => set({ category: selectedCats.filter((s) => s !== slug).join(',') }) })),
    filters.search && { key: 's', label: `“${filters.search}”`, clear: () => set({ search: '' }) },
    (filters.minPrice || filters.maxPrice) && {
      key: 'p',
      label: `${filters.minPrice ? formatPrice(filters.minPrice) : '₹0'} – ${filters.maxPrice ? formatPrice(filters.maxPrice) : 'any'}`,
      clear: () => set({ minPrice: '', maxPrice: '' }),
    },
    filters.rating && { key: 'r', label: `${filters.rating}★ & up`, clear: () => set({ rating: '' }) },
    filters.availability && { key: 'a', label: 'In stock', clear: () => set({ availability: '' }) },
    filters.bestSeller && { key: 'b', label: 'Best sellers', clear: () => set({ bestSeller: '' }) },
    filters.newArrival && { key: 'n', label: 'New arrivals', clear: () => set({ newArrival: '' }) },
    filters.featured && { key: 'f', label: 'Featured', clear: () => set({ featured: '' }) },
  ].filter(Boolean);

  const heading = selectedCats.length === 1 ? categories.find((c) => c.slug === selectedCats[0]) : null;
  const title = filters.search ? `Results for “${filters.search}”` : heading?.name || (filters.bestSeller ? 'Best sellers' : filters.newArrival ? 'New arrivals' : 'Shop all');

  return (
    <PageTransition>
      <Seo title={title} description={heading?.description || 'Browse premium tumblers, sippers, water bottles, travel mugs and gift sets.'} canonicalPath={`/products${selectedCats.length === 1 ? `?category=${selectedCats[0]}` : ''}`} />
      <div className="container-page pt-10 pb-6 lg:pt-14">
        <p className="eyebrow">{pagination ? `${pagination.total} products` : 'Collection'}</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{title}</h1>
        {heading?.description && <p className="mt-4 max-w-xl text-muted">{heading.description}</p>}

        <div className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button onClick={() => set({ category: '' })} className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition', !selectedCats.length ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink')}>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => set({ category: selectedCats.length === 1 && selectedCats[0] === c.slug ? '' : c.slug })}
              className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition', selectedCats.length === 1 && selectedCats[0] === c.slug ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink')}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-[74px] z-30 border-y border-line bg-canvas/85 backdrop-blur-xl">
        <div className="container-page flex items-center gap-3 py-3">
          <Button variant="secondary" size="sm" className="lg:hidden" leftIcon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setFiltersOpen(true)}>
            Filters{activeChips.length ? ` (${activeChips.length})` : ''}
          </Button>
          <div className="relative hidden max-w-xs flex-1 sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <label htmlFor="plp-search" className="sr-only">
              Search products
            </label>
            <input id="plp-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in collection" className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm outline-none focus:border-ink" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="sort" className="hidden text-sm text-muted sm:block">
              Sort by
            </label>
            <div className="relative">
              <select id="sort" value={filters.sort || 'newest'} onChange={(e) => set({ sort: e.target.value })} className="h-10 appearance-none rounded-full border border-line-strong bg-surface pr-9 pl-4 text-sm font-semibold outline-none focus:border-ink">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 pt-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-36">
            <Filters params={params} set={set} categories={categories} priceRange={priceRange} />
          </div>
        </aside>

        <section aria-live="polite" aria-busy={query.isFetching}>
          {activeChips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => (
                <button key={c.key} onClick={c.clear} className="inline-flex items-center gap-1.5 rounded-full bg-sand py-1.5 pr-2.5 pl-3.5 text-[13px] font-semibold hover:bg-line">
                  {c.label} <X className="h-3.5 w-3.5" aria-label="remove filter" />
                </button>
              ))}
              <button onClick={() => setParams({})} className="px-2 text-[13px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
                Clear all
              </button>
            </div>
          )}

          {query.isError ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : !query.isLoading && items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match"
              description="Try removing a filter or searching for something broader like “tumbler”."
              action={<Button onClick={() => setParams({})}>Clear filters</Button>}
            />
          ) : (
            <div className={cn('transition-opacity', query.isFetching && !query.isFetchingNextPage && !query.isLoading && 'opacity-60')}>
              <ProductGrid products={items} loading={query.isLoading} skeletonCount={LIMIT} columns="grid-cols-2 md:grid-cols-3" />
            </div>
          )}

          {isDesktop ? (
            <Pagination
              className="mt-14"
              page={page}
              pages={pagination?.pages}
              onChange={(p) => {
                set({ page: p > 1 ? String(p) : '' }, { keepPage: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : (
            <div ref={sentinel} className="flex h-24 items-center justify-center">
              {query.isFetchingNextPage && <span className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-label="Loading more" />}
              {!query.hasNextPage && items.length > LIMIT && <p className="text-sm text-muted">You’ve seen it all ✦</p>}
            </div>
          )}
        </section>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="left"
        title="Filters"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setParams({})}>
              Clear all
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {pagination?.total ?? ''} results</Button>
          </div>
        }
      >
        <div className="px-5">
          <Filters params={params} set={set} categories={categories} priceRange={priceRange} />
        </div>
      </Drawer>
    </PageTransition>
  );
}
