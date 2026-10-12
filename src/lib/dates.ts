// Date helpers. Calendar dates are stored as local 'YYYY-MM-DD' strings to avoid timezone drift.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISODate(s);
  return toISODate(d) === s;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday of the week containing the date. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

export function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!iso) return '—';
  const d = parseISODate(iso.slice(0, 10));
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const withYear = opts.year === false ? base : `${base} ${d.getFullYear()}`;
  return opts.weekday ? `${DAYS[d.getDay()]} ${withYear}` : withYear;
}

export function formatDateTime(isoTs: string): string {
  const d = new Date(isoTs);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Friendly relative label for a calendar date relative to today. */
export function relativeDay(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -30) return `${-diff} days ago`;
  return formatDate(iso);
}

export function timeAgo(isoTs: string, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(isoTs).getTime()) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(isoTs.slice(0, 10));
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
