// Content library filtering and sorting (pure, testable).
import { titleTokens } from './matching';
import { median, videoPerformance, type VideoPerformance } from './metrics';
import { localToUtc } from './parse';
import type { Snapshot, Video } from './types';

export interface LibraryQuery {
  q?: string;
  category?: string;
  format?: string;
  hook?: string;
  type?: string;
  from?: string;
  to?: string;
  perf?: string;
  dur?: string;
  status?: string;
  sort?: string;
}

export function filterLibrary(videos: Video[], byVideo: Map<string, Snapshot[]>, query: LibraryQuery, now: Date): VideoPerformance[] {
  let rows = videos.map((v) => videoPerformance(v, byVideo.get(v.id), now));
  const q = query.q?.trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/);
    rows = rows.filter((r) => {
      const hay = [r.video.title, r.video.topic, r.video.hook, r.video.caption, r.video.notes, r.video.hashtags.join(' ')].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  if (query.category) rows = rows.filter((r) => (query.category === 'none' ? !r.video.category : r.video.category === query.category));
  if (query.format) rows = rows.filter((r) => r.video.format === query.format);
  if (query.hook) rows = rows.filter((r) => r.video.hook_style === query.hook);
  if (query.type) rows = rows.filter((r) => r.video.record_type === query.type);
  if (query.status) rows = rows.filter((r) => r.video.tracking_status === query.status);
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    const t = localToUtc(query.from, '00:00').toISOString();
    rows = rows.filter((r) => r.video.published_at && r.video.published_at >= t);
  }
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    const t = new Date(localToUtc(query.to, '23:59').getTime() + 59_999).toISOString();
    rows = rows.filter((r) => r.video.published_at && r.video.published_at <= t);
  }
  if (query.dur) {
    const d = query.dur;
    rows = rows.filter((r) => {
      const s = r.video.duration_seconds;
      if (d === 'unknown') return s == null;
      if (s == null) return false;
      return d === 'short' ? s < 15 : d === 'mid' ? s >= 15 && s < 30 : d === 'long' ? s >= 30 && s <= 60 : s > 60;
    });
  }
  if (query.perf) {
    // Thresholds are computed over the whole library, so "top 25%" means top 25% of all your videos.
    const all = videos.map((v) => videoPerformance(v, byVideo.get(v.id), now).views).filter((x): x is number => x != null).sort((a, b) => a - b);
    const quart = (p: number) => (all.length ? all[Math.min(all.length - 1, Math.floor(p * (all.length - 1)))] : 0);
    const med = median(all) ?? 0;
    rows = rows.filter((r) => {
      if (query.perf === 'none') return r.views == null;
      if (r.views == null) return false;
      if (query.perf === 'top') return r.views >= quart(0.75);
      if (query.perf === 'bottom') return r.views <= quart(0.25);
      if (query.perf === 'above') return r.views > med;
      return r.views <= med;
    });
  }
  const byDate = (a: VideoPerformance, b: VideoPerformance) => (b.video.published_at ?? '').localeCompare(a.video.published_at ?? '');
  switch (query.sort) {
    case 'oldest':
      rows.sort((a, b) => -byDate(a, b));
      break;
    case 'views':
      rows.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
      break;
    case 'least':
      rows.sort((a, b) => (a.views ?? Infinity) - (b.views ?? Infinity));
      break;
    case 'engagement':
      rows.sort((a, b) => (b.engagement ?? -1) - (a.engagement ?? -1));
      break;
    default:
      rows.sort(byDate);
  }
  return rows;
}

export interface TopicGroup {
  label: string;
  videos: Video[];
}

/**
 * Groups videos that share an explicit topic, or whose titles share most of their key words.
 * A simple text-similarity signal; AI classification of repetition comes in Phase 2.
 */
export function repeatedTopics(videos: Video[]): TopicGroup[] {
  const groups = new Map<string, Video[]>();
  for (const v of videos) {
    if (!v.topic) continue;
    const key = v.topic.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([, list]) => ({ label: list[0].topic!, videos: list }))
    .sort((a, b) => b.videos.length - a.videos.length);
}

/** Other videos with overlapping title/topic words (for "related videos" on a detail page). */
export function relatedVideos(video: Video, all: Video[], limit = 5): { video: Video; overlap: number }[] {
  const mine = new Set([...titleTokens(video.title), ...(video.topic ? titleTokens(video.topic) : [])].filter((t) => t.length > 2));
  if (!mine.size) return [];
  return all
    .filter((v) => v.id !== video.id)
    .map((v) => {
      const theirs = new Set([...titleTokens(v.title), ...(v.topic ? titleTokens(v.topic) : [])].filter((t) => t.length > 2));
      let inter = 0;
      for (const t of mine) if (theirs.has(t)) inter++;
      const sameTopic = video.topic && v.topic && video.topic.trim().toLowerCase() === v.topic.trim().toLowerCase();
      return { video: v, overlap: sameTopic ? 1 : inter / Math.max(1, Math.min(mine.size, theirs.size)) };
    })
    .filter((x) => x.overlap >= 0.5)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}
