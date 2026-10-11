const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

/** ₹1,799 — or ₹1,799.50 when there are paise. */
export const formatPrice = (n = 0) => (Number.isInteger(Number(n)) ? inr.format(n || 0) : inrPrecise.format(n || 0));
export const formatCompactPrice = (n = 0) => `₹${compact.format(n || 0)}`;
export const formatNumber = (n = 0) => new Intl.NumberFormat('en-IN').format(n || 0);

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Intl.DateTimeFormat('en-IN', opts).format(new Date(d)) : '';
export const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '';

export function timeAgo(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2629800, 'month'],
    [31557600, 'year'],
  ];
  let unit = units[0];
  for (const u of units) if (diff >= u[0]) unit = u;
  const value = Math.floor(diff / unit[0]);
  return `${value} ${unit[1]}${value === 1 ? '' : 's'} ago`;
}

export const pluralize = (n, word, plural = `${word}s`) => `${formatNumber(n)} ${n === 1 ? word : plural}`;

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
