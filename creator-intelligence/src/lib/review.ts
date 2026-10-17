// Turns an AI transcription into editable review entries, and reviewed entries into the
// validated confirm payload. Pure and isomorphic (runs in the review screen; unit-tested).
import type { ExtractedAccount, ExtractedDetail, Extraction, ExtractedVideo } from './extraction/schema';
import { findMatches, type MatchResult } from './matching';
import { localToUtc, parseCount, parseDuration, parsePercent, parsePublishedText, parseTikTokVideoId } from './parse';
import type { MatchCandidate, ScreenshotKind } from './types';
import type { ConfirmEntry } from './validation';

export type Decision = 'new' | { videoId: string } | null;

export interface ReviewEntry {
  key: string;
  include: boolean;
  title: string;
  titleTruncated: boolean;
  publishedText: string | null;
  date: string;
  time: string;
  dateTouched: boolean;
  ambiguousDate: boolean;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  duration: string;
  tiktokUrl: string;
  box: ExtractedVideo['thumbnail_box'];
  useThumbnail: boolean;
  partial: boolean;
  uncertain: string[];
  note: string | null;
  decision: Decision;
  autoDecision: boolean;
}

export const COUNT_KEYS = ['views', 'likes', 'comments', 'shares', 'saves'] as const;

let seq = 0;
export function blankEntry(over: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    key: `e${++seq}`,
    include: true,
    title: '',
    titleTruncated: false,
    publishedText: null,
    date: '',
    time: '',
    dateTouched: false,
    ambiguousDate: false,
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    duration: '',
    tiktokUrl: '',
    box: null,
    useThumbnail: false,
    partial: false,
    uncertain: [],
    note: null,
    decision: 'new',
    autoDecision: true,
    ...over
  };
}

/** Applies parsePublishedText for the given screenshot time unless the user edited the date. */
export function withParsedDate(e: ReviewEntry, observedAt: Date): ReviewEntry {
  if (e.dateTouched) return e;
  const p = parsePublishedText(e.publishedText, observedAt);
  return { ...e, date: p?.localDate ?? '', time: p?.localTime ?? '', ambiguousDate: p?.ambiguous ?? false };
}

export function entryMatches(e: ReviewEntry, candidates: MatchCandidate[]): MatchResult[] {
  return findMatches(
    {
      title: e.title || null,
      titleTruncated: e.titleTruncated,
      tiktokVideoId: parseTikTokVideoId(e.tiktokUrl),
      publishedAt: e.date ? localToUtc(e.date, e.time || '12:00').toISOString() : null
    },
    candidates
  );
}

/**
 * The cautious default: certain or likely matches are pre-selected (the user still sees them),
 * possible matches require an explicit choice, and no match means "new video".
 */
export function defaultDecision(matches: MatchResult[]): Decision {
  const best = matches[0];
  if (!best) return 'new';
  if (best.level === 'exact_id' || best.level === 'likely') return { videoId: best.candidate.id };
  return null;
}

export function initialEntries(args: {
  extraction: Extraction | null;
  kind: ScreenshotKind;
  observedAt: Date;
  candidates: MatchCandidate[];
  targetVideoId: string | null;
}): ReviewEntry[] {
  const { extraction, kind, observedAt, candidates, targetVideoId } = args;
  const rows = extraction?.videos ?? [];
  let entries = rows.map((v) =>
    withParsedDate(
      blankEntry({
        title: v.title_text ?? '',
        titleTruncated: v.title_truncated,
        publishedText: v.published_text,
        views: v.views_text ?? '',
        likes: v.likes_text ?? '',
        comments: v.comments_text ?? '',
        shares: v.shares_text ?? '',
        saves: v.saves_text ?? '',
        duration: v.duration_text ?? '',
        tiktokUrl: parseTikTokVideoId(v.tiktok_url_or_id) ? v.tiktok_url_or_id ?? '' : '',
        box: v.thumbnail_box,
        useThumbnail: Boolean(v.thumbnail_box) && kind === 'video_list',
        partial: v.partially_visible,
        uncertain: v.uncertain_fields,
        note: v.notes,
        // Rows with no title and no numbers are not useful records.
        include: Boolean(v.title_text || v.views_text)
      }),
      observedAt
    )
  );
  if (kind === 'video_analytics' && entries.length === 0) entries = [blankEntry()];
  if (kind === 'video_analytics' && entries.length > 1) entries = entries.map((e, i) => ({ ...e, include: i === 0 }));
  return entries.map((e, i) => {
    if (kind === 'video_analytics' && targetVideoId && i === 0) return { ...e, decision: { videoId: targetVideoId }, autoDecision: true };
    return { ...e, decision: defaultDecision(entryMatches(e, candidates)) };
  });
}

export type EntryResult = { ok: true; entry: ConfirmEntry } | { ok: false; error: string };

/** Converts one reviewed entry into the confirm payload, or explains what is wrong. */
export function toConfirmEntry(e: ReviewEntry, thumbnail: string | null): EntryResult {
  const label = e.title ? `“${e.title.slice(0, 40)}”` : 'An entry';
  if (!e.include) {
    return { ok: true, entry: { include: false, action: 'create', title: e.title, title_truncated: e.titleTruncated, published_at: null, published_at_precision: 'unknown', approximate_fields: [] } };
  }
  if (e.decision === null) return { ok: false, error: `${label}: choose whether this is a new video or one you already have.` };
  if (e.decision === 'new' && !e.title.trim()) return { ok: false, error: 'Every new video needs a title (type the visible text).' };
  const counts: Partial<Record<(typeof COUNT_KEYS)[number], number | null>> = {};
  const approximate: string[] = [];
  for (const k of COUNT_KEYS) {
    const raw = e[k].trim();
    if (!raw) {
      counts[k] = null;
      continue;
    }
    const p = parseCount(raw);
    if (!p) return { ok: false, error: `${label}: ${k} “${raw}” is not a number. Correct it or clear it.` };
    counts[k] = p.value;
    if (p.approximate) approximate.push(k);
  }
  let duration: number | null = null;
  if (e.duration.trim()) {
    const d = parseDuration(e.duration);
    if (d == null) return { ok: false, error: `${label}: duration “${e.duration}” should look like 0:45.` };
    duration = Math.round(d);
  }
  if (e.tiktokUrl.trim() && !parseTikTokVideoId(e.tiktokUrl)) return { ok: false, error: `${label}: the TikTok link must contain the video ID.` };
  const published_at = e.date ? localToUtc(e.date, e.time || '12:00').toISOString() : null;
  return {
    ok: true,
    entry: {
      include: true,
      action: e.decision === 'new' ? 'create' : 'match',
      video_id: e.decision === 'new' ? null : e.decision.videoId,
      confirmed_new: e.decision === 'new' && !e.autoDecision ? true : undefined,
      title: e.title.trim(),
      title_truncated: e.titleTruncated,
      tiktok_url: e.tiktokUrl.trim() || null,
      published_at,
      published_at_precision: e.date ? (e.time ? 'datetime' : 'date') : 'unknown',
      duration_seconds: duration,
      views: counts.views ?? null,
      likes: counts.likes ?? null,
      comments: counts.comments ?? null,
      shares: counts.shares ?? null,
      saves: counts.saves ?? null,
      approximate_fields: approximate,
      thumbnail_data: e.useThumbnail ? thumbnail : null
    }
  };
}

export interface DetailState {
  avg: string;
  total: string;
  full: string;
  followers: string;
  traffic: { source: string; percent: string }[];
  retention: string;
}

export function initialDetail(d: ExtractedDetail | null): DetailState {
  return {
    avg: d?.avg_watch_time_text ?? '',
    total: d?.total_play_time_text ?? '',
    full: d?.full_watch_rate_text ?? '',
    followers: d?.new_followers_text ?? '',
    traffic: (d?.traffic_sources ?? []).map((t) => ({ source: t.source, percent: t.percent_text })),
    retention: d?.retention_notes ?? ''
  };
}

export function toConfirmDetail(d: DetailState) {
  const errors: string[] = [];
  const dur = (raw: string, name: string) => {
    if (!raw.trim()) return null;
    const v = parseDuration(/^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}s` : raw);
    if (v == null) errors.push(`${name} “${raw}” is not a time.`);
    return v;
  };
  const avg = dur(d.avg, 'Average watch time');
  const total = dur(d.total, 'Total play time');
  let full: number | null = null;
  if (d.full.trim()) {
    full = parsePercent(d.full.includes('%') ? d.full : `${d.full}%`);
    if (full == null) errors.push(`Watched full video “${d.full}” is not a percentage.`);
  }
  let followers: number | null = null;
  if (d.followers.trim()) {
    const p = parseCount(d.followers.replace(/^\+/, ''));
    if (!p) errors.push(`New followers “${d.followers}” is not a number.`);
    followers = p?.value ?? null;
  }
  const traffic: { source: string; percent: number }[] = [];
  for (const t of d.traffic) {
    if (!t.source.trim() && !t.percent.trim()) continue;
    const p = parsePercent(t.percent.includes('%') ? t.percent : `${t.percent}%`);
    if (p == null || !t.source.trim()) errors.push(`Traffic source “${t.source} ${t.percent}” needs a name and a percentage.`);
    else traffic.push({ source: t.source.trim(), percent: p });
  }
  if (errors.length) return { ok: false as const, error: errors[0] };
  return {
    ok: true as const,
    detail: { avg_watch_time_seconds: avg, total_play_time_seconds: total, completion_rate: full, new_followers: followers, traffic_sources: traffic, retention: d.retention.trim() || null }
  };
}

export interface AccountState {
  followers: string;
  totalLikes: string;
  periodLabel: string;
  periodDays: string;
  periodViews: string;
  profileViews: string;
  likes: string;
  comments: string;
  shares: string;
  followersChange: string;
}

export function initialAccount(a: ExtractedAccount | null): AccountState {
  const label = a?.period_label ?? '';
  const days = label.match(/(\d+)\s*days?/i)?.[1] ?? '';
  return {
    followers: a?.followers_text ?? '',
    totalLikes: a?.total_likes_text ?? '',
    periodLabel: label,
    periodDays: days,
    periodViews: a?.period_views_text ?? '',
    profileViews: a?.period_profile_views_text ?? '',
    likes: a?.period_likes_text ?? '',
    comments: a?.period_comments_text ?? '',
    shares: a?.period_shares_text ?? '',
    followersChange: a?.period_followers_change_text ?? ''
  };
}

export function toConfirmAccount(a: AccountState, capturedAt: string) {
  const approximate: string[] = [];
  const errors: string[] = [];
  const num = (raw: string, field: string, name: string, signed = false) => {
    const s = raw.trim();
    if (!s) return null;
    const neg = signed && /^[-−]/.test(s);
    const p = parseCount(s.replace(/^[+\-−]/, ''));
    if (!p) {
      errors.push(`${name} “${raw}” is not a number.`);
      return null;
    }
    if (p.approximate) approximate.push(field);
    return neg ? -p.value : p.value;
  };
  const out = {
    captured_at: capturedAt,
    followers: num(a.followers, 'followers', 'Followers'),
    total_likes: num(a.totalLikes, 'total_likes', 'Total likes'),
    period_label: a.periodLabel.trim() || null,
    period_days: a.periodDays.trim() ? Number(a.periodDays) : null,
    period_views: num(a.periodViews, 'period_views', 'Video views'),
    period_profile_views: num(a.profileViews, 'period_profile_views', 'Profile views'),
    period_likes: num(a.likes, 'period_likes', 'Likes'),
    period_comments: num(a.comments, 'period_comments', 'Comments'),
    period_shares: num(a.shares, 'period_shares', 'Shares'),
    period_followers_change: num(a.followersChange, 'period_followers_change', 'Net followers', true),
    approximate_fields: approximate
  };
  if (out.period_days != null && (!Number.isInteger(out.period_days) || out.period_days < 1 || out.period_days > 366)) errors.push('Period length must be a number of days.');
  if (errors.length) return { ok: false as const, error: errors[0] };
  const any = out.followers != null || out.total_likes != null || out.period_views != null || out.period_followers_change != null;
  return { ok: true as const, account: any ? out : null };
}
