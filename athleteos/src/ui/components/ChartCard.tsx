import { useState, type ReactNode } from 'react';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { formatShortDate } from '@/lib/dates';

// Chart conventions (dark surface): one series = one hue (#3987e5), 2px lines, ≥8px markers,
// solid hairline grid one step off the surface, 4px rounded bar ends, tooltip on every chart,
// and a table view so values are never colour- or hover-only.

export interface ChartPoint {
  x: string; // ISO date or label
  y: number | null;
}

const AXIS = { fill: 'var(--chart-axis)', fontSize: 11 };

function TooltipBox({ active, payload, label, format, xFormat }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (v: number) => string; xFormat: (x: string) => string }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground">{label ? xFormat(label) : ''}</p>
      <p className="text-sm font-bold text-foreground">{format(payload[0].value)}</p>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  data,
  kind = 'line',
  format,
  xFormat = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? formatShortDate(x) : x),
  empty = 'Not enough data yet.',
  minPoints = 1,
  reference,
  lowerIsBetter,
  footer
}: {
  title: string;
  description?: ReactNode;
  data: ChartPoint[];
  kind?: 'line' | 'bar';
  format: (v: number) => string;
  xFormat?: (x: string) => string;
  empty?: string;
  minPoints?: number;
  reference?: { y: number; label: string };
  lowerIsBetter?: boolean;
  footer?: ReactNode;
}) {
  const [table, setTable] = useState(false);
  const pts = data.filter((d) => d.y != null);
  const enough = pts.length >= minPoints;
  const values = pts.map((p) => p.y as number);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  // Small values (sprint times, jump distances) keep decimals; loads and reps use whole-number bounds.
  const small = hi < 10;
  const domain: [number, number] =
    kind === 'bar' ? [0, Math.ceil(hi + pad)] : small ? [Math.max(0, lo - pad), hi + pad] : [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  const decimals = small ? 2 : 0;
  const yTick = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Number(v.toFixed(decimals))));
  const best = values.length ? (lowerIsBetter ? lo : hi) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {enough && (
          <button
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            onClick={() => setTable(!table)}
            aria-pressed={table}
            aria-label={table ? `Show ${title} as chart` : `Show ${title} as table`}
          >
            {table ? <LineIcon className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            {table ? 'Chart' : 'Table'}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {!enough ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : table ? (
          <div className="max-h-64 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pts
                  .slice()
                  .reverse()
                  .map((p, i) => (
                    <tr key={`${p.x}-${i}`}>
                      <td className="px-3 py-1.5">{xFormat(p.x)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular">{format(p.y as number)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {best != null && kind === 'line' && (
              <p className="mb-1 text-xs text-muted-foreground">
                {lowerIsBetter ? 'Best' : 'Peak'}: <span className="font-semibold text-foreground">{format(best)}</span> · Latest: <span className="font-semibold text-foreground">{format(values[values.length - 1])}</span>
              </p>
            )}
            <div className="h-48 w-full" role="img" aria-label={`${title}: ${pts.length} data points from ${xFormat(pts[0].x)} to ${xFormat(pts[pts.length - 1].x)}`}>
              <ResponsiveContainer width="100%" height="100%">
                {kind === 'line' ? (
                  <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="x" tickFormatter={xFormat} tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} minTickGap={24} />
                    <YAxis domain={domain} tickFormatter={yTick} tick={AXIS} tickLine={false} axisLine={false} width={40} reversed={lowerIsBetter} allowDecimals={small} tickCount={5} />
                    <Tooltip content={<TooltipBox format={format} xFormat={xFormat} />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
                    {reference && <ReferenceLine y={reference.y} stroke="var(--chart-axis)" strokeOpacity={0.6} label={{ value: reference.label, fill: 'var(--chart-axis)', fontSize: 10, position: 'insideTopLeft' }} />}
                    <Line type="monotone" dataKey="y" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'hsl(var(--card))', strokeWidth: 2 }} activeDot={{ r: 6, stroke: 'hsl(var(--card))', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                ) : (
                  <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="x" tickFormatter={xFormat} tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} minTickGap={16} />
                    <YAxis domain={domain} tickFormatter={yTick} tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                    <Tooltip content={<TooltipBox format={format} xFormat={xFormat} />} cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5 }} />
                    {reference && <ReferenceLine y={reference.y} stroke="var(--chart-axis)" strokeOpacity={0.6} label={{ value: reference.label, fill: 'var(--chart-axis)', fontSize: 10, position: 'insideTopLeft' }} />}
                    <Bar dataKey="y" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
