import type { ISODate, Weekday } from '@/domain/types';

// All calendar logic works on local YYYY-MM-DD strings; weeks run Monday–Sunday.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: ISODate): Weekday {
  const js = parseISODate(date).getDay();
  return (js === 0 ? 7 : js) as Weekday;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, 1 - weekdayOf(date));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(parseISODate(s)) === s;
}

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday'
};
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: ISODate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseISODate(date);
  const parts = [`${d.getDate()} ${MONTHS[d.getMonth()]}`];
  if (opts.year) parts.push(String(d.getFullYear()));
  const s = parts.join(' ');
  return opts.weekday ? `${WEEKDAY_SHORT[weekdayOf(date)]} ${s}` : s;
}

export function formatShortDate(date: ISODate): string {
  const d = parseISODate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Programme week number (1-based) for a date, given the programme's start date. */
export function trainingWeek(start: ISODate, date: ISODate): number {
  const diff = daysBetween(startOfWeek(start), startOfWeek(date));
  return Math.max(1, Math.floor(diff / 7) + 1);
}
