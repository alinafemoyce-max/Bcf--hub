// Performance checkpoints (≈24h, 72h, 7d, 30d after publishing) and the screenshot update queue.
// TikTok is not connected, so the schedule is driven only by publication time and saved snapshots.

import type { Snapshot, Video } from './types';

export interface CheckpointDef {
  key: '24h' | '72h' | '7d' | '30d';
  label: string;
  targetHours: number;
  /** A snapshot taken within [minHours, maxHours] after publishing counts for this checkpoint. */
  minHours: number;
  maxHours: number;
}

export const CHECKPOINTS: CheckpointDef[] = [
  { key: '24h', label: '24-hour', targetHours: 24, minHours: 18, maxHours: 36 },
  { key: '72h', label: '72-hour', targetHours: 72, minHours: 60, maxHours: 96 },
  { key: '7d', label: '7-day', targetHours: 168, minHours: 144, maxHours: 216 },
  { key: '30d', label: '30-day', targetHours: 720, minHours: 624, maxHours: 960 }
];

const HOUR = 3_600_000;

export interface CheckpointValue {
  def: CheckpointDef;
  snapshot: Snapshot | null;
  /** Actual age of the chosen snapshot in hours after publishing. */
  ageHours: number | null;
  /** True when the publish time is only known to the day, so the age is approximate (±12h). */
  approximateAge: boolean;
}

/** For each checkpoint, the snapshot (with views) closest to the target age within its window. */
export function checkpointValues(video: Pick<Video, 'published_at' | 'published_at_precision'>, snapshots: Snapshot[]): CheckpointValue[] {
  const published = video.published_at ? new Date(video.published_at).getTime() : null;
  return CHECKPOINTS.map((def) => {
    if (published === null) return { def, snapshot: null, ageHours: null, approximateAge: false };
    let best: Snapshot | null = null;
    let bestDist = Infinity;
    for (const s of snapshots) {
      if (s.views == null) continue;
      const age = (new Date(s.captured_at).getTime() - published) / HOUR;
      if (age < def.minHours || age > def.maxHours) continue;
      const dist = Math.abs(age - def.targetHours);
      if (dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    const ageHours = best ? (new Date(best.captured_at).getTime() - published) / HOUR : null;
    return { def, snapshot: best, ageHours, approximateAge: video.published_at_precision !== 'datetime' };
  });
}

export type ReviewStatus = 'due' | 'upcoming' | 'complete' | 'not_tracked' | 'needs_publish_date';

export interface ReviewState {
  status: ReviewStatus;
  checkpoint: CheckpointDef | null;
  /** When the current/next checkpoint window opens and closes. */
  windowStart: string | null;
  windowEnd: string | null;
  missed: CheckpointDef['key'][];
}

/** What screenshot (if any) this video needs next. */
export function nextReview(
  video: Pick<Video, 'published_at' | 'published_at_precision' | 'record_type' | 'tracking_status'>,
  snapshots: Snapshot[],
  now: Date
): ReviewState {
  const none = { checkpoint: null, windowStart: null, windowEnd: null, missed: [] as CheckpointDef['key'][] };
  if (video.tracking_status === 'archived' || video.record_type !== 'tracked') return { status: 'not_tracked', ...none };
  if (!video.published_at) return { status: 'needs_publish_date', ...none };
  const published = new Date(video.published_at).getTime();
  const ageNow = (now.getTime() - published) / HOUR;
  const values = checkpointValues(video, snapshots);
  const missed: CheckpointDef['key'][] = [];
  for (const v of values) {
    if (v.snapshot) continue;
    const windowStart = new Date(published + v.def.minHours * HOUR).toISOString();
    const windowEnd = new Date(published + v.def.maxHours * HOUR).toISOString();
    if (ageNow > v.def.maxHours) {
      missed.push(v.def.key);
      continue;
    }
    const status: ReviewStatus = ageNow >= v.def.minHours ? 'due' : 'upcoming';
    return { status, checkpoint: v.def, windowStart, windowEnd, missed };
  }
  return { status: 'complete', checkpoint: null, windowStart: null, windowEnd: null, missed };
}

export interface QueueItem {
  video: Video;
  review: ReviewState;
}

/** Videos that need a screenshot now (due) or soon (upcoming within 48h), most urgent first. */
export function buildUpdateQueue(videos: Video[], snapshotsByVideo: Map<string, Snapshot[]>, now: Date): QueueItem[] {
  const items: QueueItem[] = [];
  for (const video of videos) {
    const review = nextReview(video, snapshotsByVideo.get(video.id) ?? [], now);
    if (review.status === 'due') items.push({ video, review });
    else if (review.status === 'upcoming' && review.windowStart && new Date(review.windowStart).getTime() - now.getTime() <= 48 * HOUR) {
      items.push({ video, review });
    }
  }
  return items.sort((a, b) => {
    if (a.review.status !== b.review.status) return a.review.status === 'due' ? -1 : 1;
    const ka = a.review.status === 'due' ? a.review.windowEnd! : a.review.windowStart!;
    const kb = b.review.status === 'due' ? b.review.windowEnd! : b.review.windowStart!;
    return ka.localeCompare(kb);
  });
}
