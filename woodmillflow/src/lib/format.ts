import { DISPLAY_TIME_ZONE } from './config';

type DateInput = string | number | Date;

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** DD/MM/YYYY in UK local time. */
export function formatUkDate(value: DateInput): string {
  return dateFmt.format(new Date(value));
}

/** HH:mm (24-hour) in UK local time, accounting for GMT/BST. */
export function formatUkTime(value: DateInput): string {
  return timeFmt.format(new Date(value));
}

export function formatUkDateTime(value: DateInput): string {
  return `${formatUkDate(value)} ${formatUkTime(value)}`;
}

/** Calendar date (YYYY-MM-DD) in UK local time — used for "today" comparisons and the order year. */
export function ukCalendarDate(value: DateInput = new Date()): string {
  const parts = partsFmt.formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Formats a stored YYYY-MM-DD calendar date (no time zone) as DD/MM/YYYY. */
export function formatCalendarDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatMm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)} mm`;
}

/** "3 × 800 × 400 × 18 mm" style summary (quantity × length × width × thickness). */
export function formatDimensions(item: { lengthMm: number; widthMm: number; thicknessMm: number | null }): string {
  const t = item.thicknessMm === null ? '' : ` × ${item.thicknessMm}`;
  return `${item.lengthMm} × ${item.widthMm}${t} mm`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return 'Not yet measured';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 48) return rem ? `${hours} h ${rem} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

export function relativeTime(value: DateInput, now: Date = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(value).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
