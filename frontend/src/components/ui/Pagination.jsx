import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

function range(page, pages) {
  const out = new Set([1, pages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => out.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => out.add(n));
  const sorted = [...out].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push('…');
    result.push(n);
  });
  return result;
}

export default function Pagination({ page, pages, onChange, className }) {
  if (!pages || pages <= 1) return null;
  const btn = 'grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold transition';
  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      <button className={cn(btn, 'hover:bg-sand disabled:opacity-30')} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {range(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-muted" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={n}
            className={cn(btn, n === page ? 'bg-ink text-white' : 'hover:bg-sand')}
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Page ${n}`}
          >
            {n}
          </button>
        ),
      )}
      <button className={cn(btn, 'hover:bg-sand disabled:opacity-30')} onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
