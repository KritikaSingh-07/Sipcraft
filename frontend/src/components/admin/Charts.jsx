import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { formatCompactPrice, formatPrice, formatNumber } from '@/utils/format';

/* Single-series charts in the brand hue; recessive grid/axes; hover tooltips on every chart. */
const BRAND = '#6D5BD0';
const BRAND_SOFT = '#B9A8E8';
const AXIS = { fontSize: 11, fill: '#9A98A3' };
const GRID = '#EEEBE5';

const monthLabel = (p) => {
  if (/^\d{4}-\d{2}$/.test(p)) return new Date(`${p}-01T00:00:00`).toLocaleString('en-IN', { month: 'short' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return new Date(`${p}T00:00:00`).toLocaleString('en-IN', { day: 'numeric', month: 'short' });
  return p.replace(/^\d{4}-/, '');
};

function TooltipCard({ active, payload, label, format = (v) => v, labelFormat = monthLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-muted">{labelFormat(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5 flex items-center gap-2 font-bold text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || BRAND }} aria-hidden />
          {p.name}: {format(p.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueArea({ data, height = 280, dataKey = 'revenue', name = 'Revenue', money = true }) {
  const fmt = money ? formatPrice : formatNumber;
  return (
    <div style={{ height }} role="img" aria-label={`${name} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="period" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={money ? formatCompactPrice : formatNumber} tick={AXIS} axisLine={false} tickLine={false} width={56} allowDecimals={false} />
          <Tooltip content={<TooltipCard format={fmt} />} cursor={{ stroke: '#D9D5CD', strokeWidth: 1 }} />
          <Area type="linear" dataKey={dataKey} name={name} stroke={BRAND} strokeWidth={2} fill={`url(#fill-${dataKey})`} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersBars({ data, height = 240 }) {
  return (
    <div style={{ height }} role="img" aria-label="Orders over time">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="period" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<TooltipCard format={formatNumber} />} cursor={{ fill: 'rgba(23,22,28,0.04)' }} />
          <Bar dataKey="orders" name="Orders" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranked categorical comparisons (top products, category sales). */
export function RankedBars({ data, labelKey = 'name', valueKey = 'revenue', money = true, height }) {
  const h = height || Math.max(160, data.length * 44);
  const fmt = money ? formatPrice : formatNumber;
  return (
    <div style={{ height: h }} role="img" aria-label="Ranked comparison">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickFormatter={money ? formatCompactPrice : formatNumber} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={labelKey} tick={{ ...AXIS, fill: '#2B2A33' }} axisLine={false} tickLine={false} width={150} tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
          <Tooltip content={<TooltipCard format={fmt} labelFormat={(l) => l} />} cursor={{ fill: 'rgba(23,22,28,0.04)' }} />
          <Bar dataKey={valueKey} name={money ? 'Revenue' : 'Units'} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell key={d[labelKey]} fill={i === 0 ? BRAND : BRAND_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrowthLine({ data, height = 240 }) {
  return (
    <div style={{ height }} role="img" aria-label="Total customers over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="period" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<TooltipCard format={formatNumber} />} cursor={{ stroke: '#D9D5CD' }} />
          <Line type="linear" dataKey="totalCustomers" name="Customers" stroke={BRAND} strokeWidth={2} dot={{ r: 4, fill: BRAND, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
