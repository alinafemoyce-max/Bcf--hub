// Display formatting (UK English, Europe/London). Isomorphic.
import { APP_TIME_ZONE } from './parse';

export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  const fmt = (v: number, s: string) => `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}${s}`;
  if (abs < 1e6) return fmt(n / 1e3, 'K');
  if (abs < 1e9) return fmt(n / 1e6, 'M');
  return fmt(n / 1e9, 'B');
}

export function full(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
}

export function pct(fraction: number | null | undefined, digits = 1): string {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function seconds(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s < 60) return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function date(iso: string | null | undefined, opts: { withTime?: boolean; withYear?: boolean } = {}): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    ...(opts.withYear !== false ? { year: 'numeric' } : {}),
    ...(opts.withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(d);
}

/** Publication date shown with the precision we actually know. */
export function published(iso: string | null, precision: string): string {
  if (!iso || precision === 'unknown') return 'Date unknown';
  return date(iso, { withTime: precision === 'datetime' });
}

export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const diff = now.getTime() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 60) return `${Math.round(d)}d ago`;
  return date(iso);
}

export function hoursLabel(h: number | null): string {
  if (h == null) return '—';
  if (h < 48) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(h < 240 ? 1 : 0).replace(/\.0$/, '')}d`;
}

/** Value for <input type="datetime-local"> in London time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

export const RECORD_TYPE_LABEL: Record<string, string> = {
  historical_basic: 'Historical basic import',
  tracked: 'Tracked'
};
