// Deterministic parsing of the text TikTok shows ("12.3K", "3d ago", "0:45", "23.4%").
// The vision model only transcribes what it can see; every number and date is converted here,
// so conversions are predictable, testable and never invented.
// This module is isomorphic: it runs on the server and in the browser (import review form).

export const APP_TIME_ZONE = 'Europe/London';

export interface ParsedCount {
  value: number;
  /** True when TikTok showed a rounded figure such as 12.3K or 1.2M. */
  approximate: boolean;
}

const EMPTY = /^(?:-+|—|–|n\/?a|none|null|\s*)$/i;

/** "12.3K" -> 12300 (approximate), "1,234" -> 1234, "1.2M" -> 1200000. Returns null if unreadable. */
export function parseCount(text: string | null | undefined): ParsedCount | null {
  if (text == null) return null;
  let s = String(text).trim();
  if (EMPTY.test(s)) return null;
  s = s.replace(/\b(views?|plays?|likes?|comments?|shares?|saves?|followers?|favou?rites?)\b/gi, '').trim();
  const m = s.match(/^([0-9][0-9.,\s  ]*)\s*([kmb]|thousand|million|billion)?\+?$/i);
  if (!m) return null;
  let digits = m[1].replace(/[\s  ]/g, '');
  const suffix = (m[2] || '').toLowerCase();
  if (suffix) {
    // With a suffix, a single comma is a decimal separator in some locales ("12,3K").
    if (/^\d+,\d{1,2}$/.test(digits)) digits = digits.replace(',', '.');
    // Otherwise only plain decimals or correctly grouped thousands are accepted.
    if (!/^\d+(\.\d+)?$/.test(digits) && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits)) return null;
    digits = digits.replace(/,/g, '');
    const n = Number(digits);
    if (!Number.isFinite(n)) return null;
    const mult = suffix.startsWith('k') || suffix === 'thousand' ? 1e3 : suffix.startsWith('m') ? 1e6 : 1e9;
    return { value: Math.round(n * mult), approximate: true };
  }
  // No suffix: commas/dots followed by exactly three digits are thousands separators.
  if (/^\d{1,3}([,.]\d{3})+$/.test(digits)) digits = digits.replace(/[,.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return { value: Number(digits), approximate: false };
}

/** "23.4%" -> 23.4. Accepts "23,4 %". Returns null if not a percentage between 0 and 100. */
export function parsePercent(text: string | null | undefined): number | null {
  if (text == null) return null;
  const m = String(text).trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*%$/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return n >= 0 && n <= 100 ? n : null;
}

/**
 * Durations and watch times: "0:45", "1:02:03", "45s", "8.2s", "1m 5s", "2h 3m", "1min 2s".
 * Returns seconds (may be fractional) or null.
 */
export function parseDuration(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = String(text).trim().toLowerCase();
  if (!s || EMPTY.test(s)) return null;
  const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const parts = colon.slice(1).filter((p) => p !== undefined).map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  const re = /(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g;
  let total = 0;
  let matched = false;
  for (const part of s.matchAll(re)) {
    matched = true;
    const n = Number(part[1].replace(',', '.'));
    const unit = part[2];
    total += unit.startsWith('h') ? n * 3600 : unit.startsWith('m') ? n * 60 : n;
  }
  if (!matched) return null;
  // Reject strings with leftover digits we did not understand.
  if (s.replace(re, '').match(/\d/)) return null;
  return Math.round(total * 100) / 100;
}

export type DatePrecision = 'datetime' | 'date';

export interface ParsedDate {
  /** UTC instant. For date-only values this is 12:00 local time on that date. */
  iso: string;
  precision: DatePrecision;
  /** Local calendar date (APP_TIME_ZONE), YYYY-MM-DD. */
  localDate: string;
  /** Local time HH:MM when known. */
  localTime: string | null;
  /** True when the text could be read more than one way (for example "10-12"). */
  ambiguous: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

/**
 * Parses a visible publication date relative to the moment the screenshot was taken.
 * Supports relative ("3h ago", "2d ago", "1w ago", "Yesterday"), month names ("Oct 12", "12 Oct 2025"),
 * ISO ("2025-10-12"), UK numeric ("12/10/2025") and TikTok's month-day form ("10-12").
 * Dates without a year take the most recent year that is not after the reference date.
 */
export function parsePublishedText(
  text: string | null | undefined,
  reference: Date,
  timeZone = APP_TIME_ZONE
): ParsedDate | null {
  if (text == null) return null;
  let s = String(text).trim().toLowerCase().replace(/^(posted|published|on)\s+/, '').replace(/\s+/g, ' ');
  if (!s || EMPTY.test(s)) return null;

  // Relative times
  if (/^(just now|now)$/.test(s)) return fromInstant(reference, 'datetime', timeZone);
  const rel = s.match(/^(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)\s*ago$/);
  if (rel) {
    const n = Number(rel[1]);
    const u = rel[2];
    if (u.startsWith('s')) return fromInstant(new Date(reference.getTime() - n * 1000), 'datetime', timeZone);
    if (u.startsWith('m')) return fromInstant(new Date(reference.getTime() - n * 60_000), 'datetime', timeZone);
    if (u.startsWith('h')) return fromInstant(new Date(reference.getTime() - n * 3_600_000), 'datetime', timeZone);
    const days = u.startsWith('d') ? n : n * 7;
    const local = shiftLocalDate(toLocalParts(reference, timeZone).date, -days);
    return fromLocal(local, null, timeZone, false);
  }
  if (s === 'today') return fromLocal(toLocalParts(reference, timeZone).date, null, timeZone, false);
  if (s === 'yesterday') return fromLocal(shiftLocalDate(toLocalParts(reference, timeZone).date, -1), null, timeZone, false);

  // Optional trailing time: "12 oct 2025, 18:30", "oct 12 at 6:30 pm"
  let time: string | null = null;
  const t = s.match(/[\s,]+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (t) {
    let h = Number(t[1]);
    const min = Number(t[2]);
    if (t[3] === 'pm' && h < 12) h += 12;
    if (t[3] === 'am' && h === 12) h = 0;
    if (h < 24 && min < 60) {
      time = `${pad(h)}:${pad(min)}`;
      s = s.slice(0, t.index).trim().replace(/,$/, '');
    }
  }

  const refLocal = toLocalParts(reference, timeZone).date;
  let y: number | null = null;
  let mo: number | null = null;
  let d: number | null = null;
  let ambiguous = false;

  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/))) {
    // UK order: day/month/year
    d = Number(m[1]);
    mo = Number(m[2]);
    y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    ambiguous = d <= 12 && mo <= 12 && d !== mo;
  } else if ((m = s.match(/^(\d{1,2})-(\d{1,2})$/))) {
    // TikTok shows this-year dates as month-day ("10-12" = 12 October).
    mo = Number(m[1]);
    d = Number(m[2]);
    ambiguous = mo <= 12 && d <= 12 && mo !== d;
  } else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?(?:\s+(\d{4}))?$/))) {
    d = Number(m[1]);
    mo = monthNumber(m[2]);
    y = m[3] ? Number(m[3]) : null;
  } else if ((m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?$/))) {
    mo = monthNumber(m[1]);
    d = Number(m[2]);
    y = m[3] ? Number(m[3]) : null;
  } else {
    return null;
  }
  if (!mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y == null) {
    const [ry] = refLocal.split('-').map(Number);
    y = ry;
    // A date more than a day after the reference must belong to the previous year.
    if (`${y}-${pad(mo)}-${pad(d)}` > shiftLocalDate(refLocal, 1)) y -= 1;
  }
  const local = `${y}-${pad(mo)}-${pad(d)}`;
  if (!isValidLocalDate(local)) return null;
  return fromLocal(local, time, timeZone, ambiguous);
}

function monthNumber(name: string): number | null {
  return MONTHS[name.slice(0, 4)] ?? MONTHS[name.slice(0, 3)] ?? null;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isValidLocalDate(local: string) {
  const [y, m, d] = local.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function shiftLocalDate(local: string, days: number): string {
  const [y, m, d] = local.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Local calendar date and time of an instant in a time zone. */
export function toLocalParts(instant: Date, timeZone = APP_TIME_ZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Converts a local date + time in a time zone to a UTC instant (handles BST/GMT). */
export function localToUtc(localDate: string, localTime: string, timeZone = APP_TIME_ZONE): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = localTime.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of the zone at the guessed instant, then correct once more around DST changes.
  let result = guess - zoneOffsetMs(new Date(guess), timeZone);
  result = guess - zoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const { date, time } = toLocalParts(instant, timeZone);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  return asUtc - Math.floor(instant.getTime() / 60000) * 60000;
}

function fromInstant(instant: Date, precision: DatePrecision, timeZone: string): ParsedDate {
  const { date, time } = toLocalParts(instant, timeZone);
  return { iso: instant.toISOString(), precision, localDate: date, localTime: time, ambiguous: false };
}

function fromLocal(localDate: string, localTime: string | null, timeZone: string, ambiguous: boolean): ParsedDate {
  const instant = localToUtc(localDate, localTime ?? '12:00', timeZone);
  return {
    iso: instant.toISOString(),
    precision: localTime ? 'datetime' : 'date',
    localDate,
    localTime,
    ambiguous
  };
}

/** Extracts the numeric TikTok video id from a URL like https://www.tiktok.com/@user/video/7351234567890123456. */
export function parseTikTokVideoId(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = String(text).trim();
  const fromUrl = s.match(/\/video\/(\d{15,22})/);
  if (fromUrl) return fromUrl[1];
  if (/^\d{15,22}$/.test(s)) return s;
  return null;
}
