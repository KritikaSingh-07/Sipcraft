import { cn } from '@/utils/cn';
import { Skeleton } from './Feedback';

/**
 * Responsive table: a real <table> on md+, stacked cards on mobile.
 * columns: [{ key, header, render?(row), className?, hideOnMobile?, mobileLabel? }]
 */
export default function DataTable({ columns, rows, loading, rowKey = '_id', onRowClick, empty, selectable, selected = [], onSelect, className, skeletonRows = 6 }) {
  const allSelected = rows?.length > 0 && rows.every((r) => selected.includes(r[rowKey]));
  const toggleAll = () => onSelect?.(allSelected ? [] : rows.map((r) => r[rowKey]));
  const toggle = (id) => onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (!loading && rows && rows.length === 0) return empty || null;

  return (
    <div className={cn('overflow-hidden rounded-3xl border border-line bg-surface', className)}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/70">
              {selectable && (
                <th className="w-12 px-5 py-3.5">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-5 py-3.5 text-[11px] font-bold tracking-[0.12em] text-muted uppercase', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {selectable && <td className="px-5 py-4" />}
                    {columns.map((c) => (
                      <td key={c.key} className="px-5 py-4">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row[rowKey]}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('border-b border-line transition-colors last:border-0', onRowClick && 'cursor-pointer hover:bg-canvas', selected.includes(row[rowKey]) && 'bg-brand-soft/40')}
                  >
                    {selectable && (
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="h-4 w-4 accent-ink" checked={selected.includes(row[rowKey])} onChange={() => toggle(row[rowKey])} aria-label="Select row" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-5 py-4 align-middle', c.className)}>
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-line md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </li>
            ))
          : rows.map((row) => (
              <li key={row[rowKey]} className={cn('flex gap-3 p-4', onRowClick && 'cursor-pointer active:bg-canvas')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {selectable && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-ink"
                    checked={selected.includes(row[rowKey])}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(row[rowKey])}
                    aria-label="Select row"
                  />
                )}
                <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2">
                  {columns
                    .filter((c) => !c.hideOnMobile)
                    .map((c, i) => (
                      <div key={c.key} className={cn('min-w-0', i === 0 && 'col-span-2')}>
                        {i > 0 && <dt className="text-[10px] font-bold tracking-[0.12em] text-subtle uppercase">{c.mobileLabel || c.header}</dt>}
                        <dd className="min-w-0 text-sm">{c.render ? c.render(row) : row[c.key]}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
      </ul>
    </div>
  );
}
