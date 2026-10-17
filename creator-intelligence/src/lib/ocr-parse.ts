// Turns text lines recognised on the phone (free Tesseract OCR) into the same transcription
// shape Claude returns, so the review screen works the same way. OCR has no understanding of the
// layout, so fields are matched by position and keywords, every value is flagged as uncertain, and
// nothing is filled in that was not read from the image. Pure and isomorphic (unit-tested).
import type { Extraction, ExtractedVideo } from './extraction/schema';
import { parseCount, parseDuration, parsePercent, parsePublishedText } from './parse';
import type { ScreenshotKind } from './types';

export interface OcrLine {
  text: string;
  /** Bounding box in image pixels. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence?: number;
}

export type StoredExtraction = Extraction & { ocr_lines?: string[] };

export const OCR_MODEL_LABEL = 'on-device-ocr';

const OCR_WARNING =
  'Read on your phone with free text recognition. It cannot tell which number is which, so numbers are matched by position: check every value against the screenshot.';

// Interface text that is never a video title.
const CHROME = new Set(
  [
    'posts', 'post', 'content', 'analytics', 'overview', 'studio', 'tiktok studio', 'tiktok', 'views', 'view', 'likes', 'comments', 'shares',
    'saves', 'sort', 'filter', 'all', 'public', 'private', 'friends', 'draft', 'drafts', 'videos', 'video', 'newest', 'oldest', 'most viewed',
    'search', 'edit', 'manage', 'home', 'inbox', 'profile', 'following', 'see all', 'more', 'back', 'done', 'viewers', 'engagement',
    'followers', 'insights', 'posted', 'date posted', 'performance', 'key metrics', 'latest', 'popular', 'cancel', 'details'
  ]
);
const METRIC_WORDS = /^(views?|plays?|likes?|comments?|shares?|saves?|favou?rites?|followers?)$/i;

const DATE_PATTERNS = [
  /\b\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)\s*ago\b/i,
  /\b(?:yesterday|today|just now)\b/i,
  /\b\d{4}-\d{1,2}-\d{1,2}\b/,
  /\b\d{1,2}[/.]\d{1,2}[/.](?:\d{4}|\d{2})\b/,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?(?:\s+\d{4})?(?:,?\s+\d{1,2}:\d{2})?/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?(?:\s+\d{4})?(?:,?\s+(?:at\s+)?\d{1,2}:\d{2})?/i,
  /(?<![\d.,])\d{1,2}-\d{1,2}(?![\d.,])/
];

/** Finds a visible date in a line (validated by the real date parser) and returns it with the rest of the line. */
export function splitDate(text: string, reference: Date): { date: string | null; rest: string } {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (m && parsePublishedText(m[0], reference)) {
      return { date: m[0].trim(), rest: (text.slice(0, m.index) + ' ' + text.slice(m.index! + m[0].length)).trim() };
    }
  }
  return { date: null, rest: text };
}

function clean(text: string) {
  return text.replace(/[|•·]+/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Classified {
  title: string | null;
  date: string | null;
  counts: string[];
}

/** Splits one OCR line into title text, a date, and count-like numbers. */
export function classifyLine(raw: string, reference: Date): Classified {
  const text = clean(raw);
  const { date, rest } = splitDate(text, reference);
  const tokens = rest.split(' ').filter(Boolean);
  const words = tokens.filter((t) => /[a-z]{2,}/i.test(t) && !METRIC_WORDS.test(t) && !/^\d+(?:[.,]\d+)?[kmb]$/i.test(t));
  const isChrome = CHROME.has(rest.toLowerCase().replace(/[^a-z ]/g, '').trim());
  if (!isChrome && (words.length >= 2 || (words.length === 1 && words[0].length >= 5 && !tokens.some((t) => parseCount(t))))) {
    return { title: rest, date, counts: [] };
  }
  const counts = tokens.filter((t) => !METRIC_WORDS.test(t) && parseCount(t) !== null);
  return { title: null, date, counts };
}

function isStatusBar(line: OcrLine, height: number) {
  return line.y1 < height * 0.06 && /^\s*\d{1,2}:\d{2}\b/.test(line.text);
}

function emptyVideo(over: Partial<ExtractedVideo>): ExtractedVideo {
  return {
    title_text: null,
    title_truncated: false,
    published_text: null,
    views_text: null,
    likes_text: null,
    comments_text: null,
    shares_text: null,
    saves_text: null,
    duration_text: null,
    tiktok_url_or_id: null,
    thumbnail_box: null,
    partially_visible: false,
    uncertain_fields: [],
    notes: null,
    ...over
  };
}

function base(lines: OcrLine[]): StoredExtraction {
  return {
    is_tiktok_screen: true,
    screen_description: 'Read with on-device text recognition',
    observed_date_text: null,
    videos: [],
    video_detail: null,
    account: null,
    warnings: [OCR_WARNING],
    ocr_lines: lines.map((l) => clean(l.text)).filter(Boolean).slice(0, 300)
  };
}

/** Post list: one entry per row (title lines, then the row's date and numbers). */
export function parseVideoList(lines: OcrLine[], size: { width: number; height: number }, reference: Date): StoredExtraction {
  const out = base(lines);
  interface Row {
    title: string[];
    date: string | null;
    counts: string[];
    top: number;
    bottom: number;
  }
  const rows: Row[] = [];
  let cur: Row | null = null;
  const start = (l: OcrLine): Row => ({ title: [], date: null, counts: [], top: l.y0, bottom: l.y1 });
  for (const line of [...lines].sort((a, b) => a.y0 - b.y0)) {
    if (!clean(line.text) || isStatusBar(line, size.height)) continue;
    const c = classifyLine(line.text, reference);
    if (c.title) {
      if (cur && (cur.date || cur.counts.length)) {
        rows.push(cur);
        cur = null;
      }
      cur ??= start(line);
      cur.title.push(c.title);
    }
    if (c.date) {
      if (cur?.date) {
        rows.push(cur);
        cur = null;
      }
      cur ??= start(line);
      cur.date = c.date;
    }
    if (c.counts.length) {
      cur ??= start(line);
      cur.counts.push(...c.counts);
    }
    if (cur) cur.bottom = Math.max(cur.bottom, line.y1);
  }
  if (cur) rows.push(cur);

  out.videos = rows
    .filter((r) => r.title.length || r.counts.length)
    .map((r, i, all) => {
      let title = r.title.join(' ').trim();
      const truncated = /(\.\.\.|…)\s*$/.test(title);
      title = title.replace(/\s*(\.\.\.|…)\s*$/, '');
      const edge = (i === 0 && r.top < size.height * 0.12) || (i === all.length - 1 && r.bottom > size.height * 0.94);
      return emptyVideo({
        title_text: title || null,
        title_truncated: truncated,
        published_text: r.date,
        views_text: r.counts[0] ?? null,
        partially_visible: edge && (!title || !r.counts.length),
        uncertain_fields: ['title', 'published', 'views'],
        notes: r.counts.length > 1 ? `Other numbers on this row: ${r.counts.slice(1).join(', ')}` : null
      });
    });
  if (!out.videos.length) out.warnings.push('No video rows were recognised. Add the entries by hand using the text list below.');
  return out;
}

type ValueKind = 'count' | 'duration' | 'percent';
interface LabelRule {
  key: string;
  re: RegExp;
  kind: ValueKind;
}

function valueOf(text: string, kind: ValueKind): string | null {
  const t = clean(text);
  // Keep any sign in the returned text (net follower changes can be negative).
  if (kind === 'count') return parseCount(t.replace(/^[+\-−]/, '')) !== null ? t : null;
  if (kind === 'percent') return parsePercent(t.replace(/\s+%$/, '%')) !== null ? t : null;
  return parseDuration(t) !== null ? t : null;
}

/** Finds the value for each label: on the same line after the label, else the nearest value line above or below. */
function keyValues(lines: OcrLine[], rules: LabelRule[]): Record<string, string> {
  const found: Record<string, string> = {};
  const used = new Set<number>();
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  for (const rule of rules) {
    for (let i = 0; i < sorted.length; i++) {
      const line = sorted[i];
      const text = clean(line.text);
      const m = text.match(rule.re);
      if (!m || found[rule.key]) continue;
      const rest = clean(text.replace(m[0], ''));
      const inline = rest.split(' ').reverse().map((t) => valueOf(t, rule.kind)).find(Boolean) ?? valueOf(rest, rule.kind);
      if (inline) {
        found[rule.key] = inline;
        continue;
      }
      const h = Math.max(8, line.y1 - line.y0);
      let best: { idx: number; dist: number; value: string } | null = null;
      for (let j = 0; j < sorted.length; j++) {
        if (j === i || used.has(j)) continue;
        const other = sorted[j];
        const overlap = Math.min(line.x1, other.x1) - Math.max(line.x0, other.x0);
        if (overlap < -h) continue;
        const dist = other.y0 >= line.y1 ? other.y0 - line.y1 : line.y0 - other.y1;
        if (dist < -h / 2 || dist > h * 3) continue;
        const value = valueOf(other.text, rule.kind);
        if (value && (!best || dist < best.dist || (dist === best.dist && other.y0 < line.y0))) best = { idx: j, dist, value };
      }
      if (best) {
        used.add(best.idx);
        found[rule.key] = best.value;
      }
    }
  }
  return found;
}

const VIDEO_RULES: LabelRule[] = [
  { key: 'avg', re: /average watch time/i, kind: 'duration' },
  { key: 'total', re: /total (?:play|watch) ?time/i, kind: 'duration' },
  { key: 'full', re: /watched (?:the )?full video/i, kind: 'percent' },
  { key: 'followers', re: /new followers/i, kind: 'count' },
  { key: 'views', re: /\b(?:video|post)?\s*views\b/i, kind: 'count' },
  { key: 'likes', re: /\blikes\b/i, kind: 'count' },
  { key: 'comments', re: /\bcomments\b/i, kind: 'count' },
  { key: 'shares', re: /\bshares\b/i, kind: 'count' },
  { key: 'saves', re: /\b(?:saves|favou?rites)\b/i, kind: 'count' }
];

/** Single video analytics screen: label/value pairs, traffic sources and any retention text. */
export function parseVideoAnalytics(lines: OcrLine[], reference: Date): StoredExtraction {
  const out = base(lines);
  const kv = keyValues(lines, VIDEO_RULES);
  let published: string | null = null;
  const traffic: { source: string; percent_text: string }[] = [];
  let retention: string | null = null;
  for (const l of lines) {
    const text = clean(l.text);
    if (!published) published = splitDate(text, reference).date;
    const t = text.match(/^([A-Za-z][A-Za-z '’]{2,30}?)\s+(\d{1,3}(?:[.,]\d+)?\s?%)$/);
    if (t && !/watched/i.test(t[1])) traffic.push({ source: t[1].trim(), percent_text: t[2].replace(/\s/g, '') });
    if (!retention && /(stopped watching|retention|drop(?:ped)? off)/i.test(text)) retention = text;
  }
  out.videos = [
    emptyVideo({
      published_text: published,
      views_text: kv.views ?? null,
      likes_text: kv.likes ?? null,
      comments_text: kv.comments ?? null,
      shares_text: kv.shares ?? null,
      saves_text: kv.saves ?? null,
      uncertain_fields: ['views', 'likes', 'comments', 'shares', 'saves', 'published'],
      notes: 'Choose which video this is, or type its title.'
    })
  ];
  out.video_detail = {
    avg_watch_time_text: kv.avg ?? null,
    total_play_time_text: kv.total ?? null,
    full_watch_rate_text: kv.full ?? null,
    new_followers_text: kv.followers ?? null,
    traffic_sources: traffic,
    retention_notes: retention,
    other_metrics: []
  };
  return out;
}

const ACCOUNT_RULES: LabelRule[] = [
  { key: 'net', re: /net followers/i, kind: 'count' },
  { key: 'followers', re: /(?<!net\s)(?<!new\s)\b(?:total\s)?followers\b/i, kind: 'count' },
  { key: 'profile', re: /profile views/i, kind: 'count' },
  { key: 'views', re: /\b(?:video|post)\s*views\b/i, kind: 'count' },
  { key: 'likes', re: /\blikes\b/i, kind: 'count' },
  { key: 'comments', re: /\bcomments\b/i, kind: 'count' },
  { key: 'shares', re: /\bshares\b/i, kind: 'count' }
];

/** Account overview: followers and period totals by label. */
export function parseAccountOverview(lines: OcrLine[]): StoredExtraction {
  const out = base(lines);
  const kv = keyValues(lines, ACCOUNT_RULES);
  const period = lines.map((l) => clean(l.text).match(/last \d{1,3} days/i)?.[0]).find(Boolean) ?? null;
  out.account = {
    followers_text: kv.followers ?? null,
    total_likes_text: null,
    period_label: period,
    period_views_text: kv.views ?? null,
    period_profile_views_text: kv.profile ?? null,
    period_likes_text: kv.likes ?? null,
    period_comments_text: kv.comments ?? null,
    period_shares_text: kv.shares ?? null,
    period_followers_change_text: kv.net ?? null
  };
  return out;
}

export function ocrToExtraction(kind: ScreenshotKind, lines: OcrLine[], size: { width: number; height: number }, reference: Date): StoredExtraction {
  if (kind === 'video_list') return parseVideoList(lines, size, reference);
  if (kind === 'video_analytics') return parseVideoAnalytics(lines, reference);
  return parseAccountOverview(lines);
}
