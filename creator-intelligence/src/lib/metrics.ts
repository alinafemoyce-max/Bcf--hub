// Dashboard calculations. Everything is derived from saved, dated snapshots; nothing is estimated.
//
// Two kinds of numbers are kept apart:
// - Video-level: the lifetime metrics of videos *published in the period*, as of the latest snapshot
//   on or before the period end. These are cumulative per video, not "views gained in the period".
// - Change over the period: views gained = (latest views at period end) − (latest views at period
//   start, or 0 if published inside the period). Only videos with snapshots on both sides count.
// - Account-level: followers and TikTok's own period totals from account snapshots.

import { localToUtc } from './parse';
import type { AccountSnapshot, MetricKey, Snapshot, Video } from './types';

export interface DateRange {
  /** null = all time */
  start: Date | null;
  end: Date;
}

export const ENGAGEMENT_DEFINITION =
  'Engagement rate = (likes + comments + shares) ÷ views, using one snapshot per video (the latest on or before the period end). ' +
  'Only videos where all four numbers were captured are included. The overall figure is weighted by views. Saves are excluded because they are often not visible.';

const DAY = 86_400_000;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function groupSnapshots(snapshots: Snapshot[]): Map<string, Snapshot[]> {
  const map = new Map<string, Snapshot[]>();
  for (const s of snapshots) {
    const list = map.get(s.video_id) ?? [];
    list.push(s);
    map.set(s.video_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  return map;
}

/** Latest snapshot captured on or before `asOf` that has a value for `field` (any snapshot if field omitted). */
export function latestSnapshot(snapshots: Snapshot[] | undefined, asOf: Date, field?: keyof Snapshot): Snapshot | null {
  if (!snapshots?.length) return null;
  const limit = asOf.getTime();
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (new Date(s.captured_at).getTime() > limit) continue;
    if (field && (s[field] === null || s[field] === undefined)) continue;
    if (!best || s.captured_at > best.captured_at) best = s;
  }
  return best;
}

export function engagementOf(s: Snapshot | null): number | null {
  if (!s || s.views == null || s.likes == null || s.comments == null || s.shares == null || s.views <= 0) return null;
  return (s.likes + s.comments + s.shares) / s.views;
}

export function inRange(video: Pick<Video, 'published_at'>, range: DateRange): boolean {
  if (!range.start) return video.published_at ? new Date(video.published_at) <= range.end : true;
  if (!video.published_at) return false;
  const t = new Date(video.published_at).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export interface VideoPerformance {
  video: Video;
  views: number | null;
  viewsApproximate: boolean;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement: number | null;
  asOf: string | null;
  ageDaysAtEnd: number | null;
}

export function videoPerformance(video: Video, snapshots: Snapshot[] | undefined, end: Date): VideoPerformance {
  const viewsSnap = latestSnapshot(snapshots, end, 'views');
  const pick = (k: MetricKey) => latestSnapshot(snapshots, end, k)?.[k] ?? null;
  const any = latestSnapshot(snapshots, end);
  return {
    video,
    views: viewsSnap?.views ?? null,
    viewsApproximate: viewsSnap?.approximate_fields.includes('views') ?? false,
    likes: pick('likes'),
    comments: pick('comments'),
    shares: pick('shares'),
    saves: pick('saves'),
    engagement: engagementOf(latestSnapshot(snapshots, end, 'views')),
    asOf: any?.captured_at ?? null,
    ageDaysAtEnd: video.published_at ? (end.getTime() - new Date(video.published_at).getTime()) / DAY : null
  };
}

export interface MetricTotal {
  sum: number;
  /** Videos in the period with a value for this metric. */
  n: number;
  approximate: boolean;
}

export interface Dashboard {
  range: { start: string | null; end: string };
  videosPublished: number;
  undatedVideos: number;
  totals: Record<MetricKey, MetricTotal>;
  averageViews: number | null;
  medianViews: number | null;
  viewsN: number;
  engagement: { rate: number | null; n: number };
  viewsGained: { value: number; videosCounted: number; videosWithoutBaseline: number } | null;
  followers: {
    latest: number | null;
    latestAt: string | null;
    change: number | null;
    baselineAt: string | null;
    snapshots: { t: string; followers: number }[];
  };
  tiktokReported: AccountSnapshot | null;
  best: VideoPerformance[];
  worst: VideoPerformance[];
  trend: { id: string; title: string; publishedAt: string; views: number; rollingMedian: number | null }[];
  byCategory: { category: string; count: number; medianViews: number | null; totalViews: number; withViews: number }[];
  latestSnapshotAt: string | null;
}

export function computeDashboard(input: {
  videos: Video[];
  snapshots: Snapshot[];
  accountSnapshots: AccountSnapshot[];
  range: DateRange;
}): Dashboard {
  const { videos, snapshots, accountSnapshots, range } = input;
  const byVideo = groupSnapshots(snapshots);
  const periodVideos = videos.filter((v) => inRange(v, range));
  const perf = periodVideos.map((v) => videoPerformance(v, byVideo.get(v.id), range.end));

  const totals = {} as Record<MetricKey, MetricTotal>;
  for (const key of ['views', 'likes', 'comments', 'shares', 'saves'] as MetricKey[]) {
    let sum = 0;
    let n = 0;
    let approximate = false;
    for (const v of periodVideos) {
      const s = latestSnapshot(byVideo.get(v.id), range.end, key);
      if (!s) continue;
      sum += s[key] as number;
      n++;
      if (s.approximate_fields.includes(key)) approximate = true;
    }
    totals[key] = { sum, n, approximate };
  }

  const viewValues = perf.map((p) => p.views).filter((x): x is number => x != null);

  let engViews = 0;
  let engSum = 0;
  let engN = 0;
  for (const p of perf) {
    const s = latestSnapshot(byVideo.get(p.video.id), range.end, 'views');
    const e = engagementOf(s);
    if (e == null || !s) continue;
    engViews += s.views!;
    engSum += s.likes! + s.comments! + s.shares!;
    engN++;
  }

  // Views gained during the period (all videos, including older ones), from snapshots.
  let viewsGained: Dashboard['viewsGained'] = null;
  if (range.start) {
    let value = 0;
    let counted = 0;
    let missing = 0;
    for (const v of videos) {
      if (!v.published_at || new Date(v.published_at) > range.end) continue;
      const list = byVideo.get(v.id);
      const endSnap = latestSnapshot(list, range.end, 'views');
      if (!endSnap) continue;
      let base: number | null;
      if (new Date(v.published_at) >= range.start) base = 0;
      else base = latestSnapshot(list, range.start, 'views')?.views ?? null;
      if (base === null) {
        missing++;
        continue;
      }
      value += Math.max(0, endSnap.views! - base);
      counted++;
    }
    viewsGained = { value, videosCounted: counted, videosWithoutBaseline: missing };
  }

  // Followers (account level)
  const follower = accountSnapshots
    .filter((a) => a.followers != null && new Date(a.captured_at) <= range.end)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const latestF = follower.at(-1) ?? null;
  let baseline: AccountSnapshot | null = null;
  if (range.start) {
    const before = follower.filter((a) => new Date(a.captured_at) <= range.start!);
    baseline = before.at(-1) ?? follower.find((a) => new Date(a.captured_at) >= range.start!) ?? null;
  } else {
    baseline = follower[0] ?? null;
  }
  const followerChange = latestF && baseline && baseline.id !== latestF.id ? latestF.followers! - baseline.followers! : null;
  const followerSeries = follower
    .filter((a) => !range.start || new Date(a.captured_at) >= range.start)
    .map((a) => ({ t: a.captured_at, followers: a.followers! }));

  const reported =
    accountSnapshots
      .filter((a) => a.period_views != null && new Date(a.captured_at) <= range.end)
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0] ?? null;

  const ranked = perf.filter((p) => p.views != null).sort((a, b) => b.views! - a.views!);
  // With few videos, split the list so "best" and "lowest" don't swallow each other.
  const best = ranked.slice(0, ranked.length < 10 ? Math.ceil(ranked.length / 2) : 5);
  // Worst list excludes videos younger than 3 days at the period end: they have not had time yet.
  const bestIds = new Set(best.map((p) => p.video.id));
  const worst = ranked
    .filter((p) => p.ageDaysAtEnd != null && p.ageDaysAtEnd >= 3 && !bestIds.has(p.video.id))
    .slice(-5)
    .reverse();

  const chronological = perf
    .filter((p) => p.views != null && p.video.published_at)
    .sort((a, b) => a.video.published_at!.localeCompare(b.video.published_at!));
  const trend = chronological.map((p, i) => {
    const window = chronological.slice(Math.max(0, i - 4), i + 1).map((x) => x.views!);
    return {
      id: p.video.id,
      title: p.video.title,
      publishedAt: p.video.published_at!,
      views: p.views!,
      rollingMedian: window.length >= 3 ? median(window) : null
    };
  });

  const cats = new Map<string, VideoPerformance[]>();
  for (const p of perf) {
    const key = p.video.category || 'Uncategorised';
    cats.set(key, [...(cats.get(key) ?? []), p]);
  }
  const byCategory = [...cats.entries()]
    .map(([category, list]) => {
      const vals = list.map((p) => p.views).filter((x): x is number => x != null);
      return {
        category,
        count: list.length,
        withViews: vals.length,
        medianViews: median(vals),
        totalViews: vals.reduce((a, b) => a + b, 0)
      };
    })
    .sort((a, b) => (b.medianViews ?? -1) - (a.medianViews ?? -1));

  const latestSnapshotAt = snapshots.reduce<string | null>((acc, s) => (!acc || s.captured_at > acc ? s.captured_at : acc), null);

  return {
    range: { start: range.start?.toISOString() ?? null, end: range.end.toISOString() },
    videosPublished: periodVideos.length,
    undatedVideos: videos.filter((v) => !v.published_at).length,
    totals,
    averageViews: viewValues.length ? viewValues.reduce((a, b) => a + b, 0) / viewValues.length : null,
    medianViews: median(viewValues),
    viewsN: viewValues.length,
    engagement: { rate: engN ? engSum / engViews : null, n: engN },
    viewsGained,
    followers: {
      latest: latestF?.followers ?? null,
      latestAt: latestF?.captured_at ?? null,
      change: followerChange,
      baselineAt: baseline && latestF && baseline.id !== latestF.id ? baseline.captured_at : null,
      snapshots: followerSeries
    },
    tiktokReported: reported,
    best,
    worst,
    trend,
    byCategory,
    latestSnapshotAt
  };
}

export type RangeKey = '7d' | '30d' | '90d' | 'all' | 'custom';

/** Resolves the dashboard date filter. Custom dates are local (Europe/London) calendar days. */
export function resolveRange(key: string | undefined, now: Date, from?: string, to?: string): { key: RangeKey; range: DateRange } {
  const days = key === '7d' ? 7 : key === '90d' ? 90 : key === 'all' ? null : key === 'custom' ? -1 : 30;
  if (days === null) return { key: 'all', range: { start: null, end: now } };
  if (days === -1 && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const start = localToUtc(from, '00:00');
    const endDay = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(localToUtc(to, '23:59').getTime() + 59_999) : now;
    const end = endDay > now ? now : endDay;
    if (start <= end) return { key: 'custom', range: { start, end } };
  }
  const d = days > 0 ? days : 30;
  return { key: d === 7 ? '7d' : d === 90 ? '90d' : '30d', range: { start: new Date(now.getTime() - d * DAY), end: now } };
}
