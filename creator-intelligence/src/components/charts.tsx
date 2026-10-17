'use client';

import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, date, full } from '@/lib/format';

const C = {
  series1: '#3987e5',
  series2: '#d95926',
  grid: '#262a31',
  axis: '#808792',
  surface: '#14161a'
};

/** Axis labels: compact for large ranges, exact when values are close together (avoids "1.5K, 1.5K"). */
function tickFormatter(values: number[]) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, max);
  return (v: number) => (max < 10_000 || max - min < 2_000 ? full(v) : compact(v));
}

const axisProps = {
  stroke: C.axis,
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false
} as const;

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[220px] rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur">{children}</div>;
}

function Key({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      <span className={line ? 'h-0.5 w-3.5 rounded' : 'size-2.5 rounded-[3px]'} style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export interface TrendPoint {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  rollingMedian: number | null;
}

/** Views per video in publication order, with a rolling median of the last five videos. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: date(d.publishedAt, { withYear: false }) }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        <Key color={C.series1} label="Views per video (latest snapshot)" />
        <Key color={C.series2} label="Rolling median (5 videos)" line />
      </div>
      <div className="h-56 w-full" role="img" aria-label="Views per video over time">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axisProps} tickFormatter={tickFormatter(rows.map((r) => r.views))} width={52} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TrendPoint;
                return (
                  <TooltipBox>
                    <div className="line-clamp-2 font-medium text-ink">{p.title}</div>
                    <div className="mt-0.5 text-ink-3">{date(p.publishedAt)}</div>
                    <div className="tnum mt-1 text-ink">{full(p.views)} views</div>
                    {p.rollingMedian != null && <div className="tnum text-ink-2">Rolling median {full(p.rollingMedian)}</div>}
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="views" fill={C.series1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Line dataKey="rollingMedian" stroke={C.series2} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** A single series over time (followers, or one video's views). */
export function TimeLineChart({ data, label }: { data: { t: string; value: number }[]; label: string }) {
  const rows = data.map((d) => ({ ...d, x: new Date(d.t).getTime() }));
  return (
    <div className="h-48 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axisProps} tickFormatter={(v) => date(new Date(v).toISOString(), { withYear: false })} minTickGap={28} />
          <YAxis {...axisProps} tickFormatter={tickFormatter(rows.map((r) => r.value))} width={52} domain={['auto', 'auto']} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: C.axis, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { t: string; value: number };
              return (
                <TooltipBox>
                  <div className="text-ink-3">{date(p.t, { withTime: true })}</div>
                  <div className="tnum mt-0.5 font-medium text-ink">
                    {full(p.value)} {label.toLowerCase()}
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Line
            dataKey="value"
            stroke={C.series1}
            strokeWidth={2}
            dot={{ r: 4, fill: C.series1, stroke: C.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: C.series1, stroke: C.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
