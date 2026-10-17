import { describe, expect, it } from 'vitest';
import { buildUpdateQueue, checkpointValues, nextReview } from '../src/lib/checkpoints';
import { computeDashboard, median, resolveRange } from '../src/lib/metrics';
import type { AccountSnapshot, Snapshot, Video } from '../src/lib/types';

let n = 0;
const video = (over: Partial<Video>): Video => ({
  id: over.id ?? `v${++n}`,
  tiktok_video_id: null,
  tiktok_url: null,
  title: 'Video',
  title_truncated: false,
  published_at: null,
  published_at_precision: 'datetime',
  duration_seconds: null,
  category: null,
  topic: null,
  hook: null,
  hook_style: null,
  caption: null,
  hashtags: [],
  format: null,
  on_camera: null,
  voiceover: null,
  shows_own_car: null,
  notes: null,
  thumbnail_data: null,
  record_type: 'tracked',
  source: 'manual',
  tracking_status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over
});
const snap = (video_id: string, captured_at: string, m: Partial<Snapshot>): Snapshot => ({
  id: `s${++n}`,
  video_id,
  captured_at,
  captured_at_source: 'user',
  source: 'manual',
  screenshot_id: null,
  views: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  avg_watch_time_seconds: null,
  total_play_time_seconds: null,
  completion_rate: null,
  new_followers: null,
  traffic_sources: null,
  retention: null,
  approximate_fields: [],
  completeness: 'basic',
  notes: null,
  created_at: captured_at,
  ...m
});
const acct = (captured_at: string, followers: number): AccountSnapshot => ({
  id: `a${++n}`,
  captured_at,
  source: 'manual',
  screenshot_id: null,
  followers,
  total_likes: null,
  period_label: null,
  period_days: null,
  period_views: null,
  period_profile_views: null,
  period_likes: null,
  period_comments: null,
  period_shares: null,
  period_followers_change: null,
  approximate_fields: [],
  notes: null,
  created_at: captured_at
});

const NOW = new Date('2026-10-17T12:00:00Z');

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('computeDashboard', () => {
  const old = video({ id: 'old', title: 'Old video', published_at: '2026-08-01T12:00:00Z', category: 'First-car advice' });
  const recent = video({ id: 'recent', title: 'Recent video', published_at: '2026-10-10T12:00:00Z', category: 'Opinions & hot takes' });
  const fresh = video({ id: 'fresh', title: 'Fresh video', published_at: '2026-10-16T12:00:00Z', category: 'Opinions & hot takes' });
  const undated = video({ id: 'undated', title: 'No date' });
  const snapshots = [
    snap('old', '2026-09-01T12:00:00Z', { views: 10000 }),
    snap('old', '2026-10-16T12:00:00Z', { views: 12000, likes: 600, comments: 40, shares: 60 }),
    snap('recent', '2026-10-11T12:00:00Z', { views: 3000, likes: 300, comments: 30, shares: 20 }),
    snap('recent', '2026-10-15T12:00:00Z', { views: 5000, approximate_fields: ['views'] }),
    snap('fresh', '2026-10-17T10:00:00Z', { views: 400 }),
    snap('undated', '2026-10-01T12:00:00Z', { views: 99999 })
  ];
  const accounts = [acct('2026-09-20T12:00:00Z', 1000), acct('2026-10-05T12:00:00Z', 1100), acct('2026-10-16T12:00:00Z', 1250)];

  it('reports lifetime totals only for videos published in the period', () => {
    const { range } = resolveRange('30d', NOW);
    const d = computeDashboard({ videos: [old, recent, fresh, undated], snapshots, accountSnapshots: accounts, range });
    expect(d.videosPublished).toBe(2);
    expect(d.totals.views).toEqual({ sum: 5400, n: 2, approximate: true });
    expect(d.medianViews).toBe(2700);
    expect(d.undatedVideos).toBe(1);
  });

  it('computes views gained from snapshots, not by summing lifetime views', () => {
    const { range } = resolveRange('30d', NOW); // 17 Sep – 17 Oct
    const d = computeDashboard({ videos: [old, recent, fresh], snapshots, accountSnapshots: [], range });
    // old: 12000 − 10000 (baseline 1 Sep) = 2000; recent: 5000 − 0; fresh: 400 − 0
    expect(d.viewsGained).toEqual({ value: 7400, videosCounted: 3, videosWithoutBaseline: 0 });
  });

  it('excludes videos without a baseline snapshot from views gained, and says so', () => {
    const { range } = resolveRange('7d', NOW); // 10 Oct – 17 Oct
    const onlyLate = snapshots.filter((s) => s.captured_at > '2026-10-02');
    const d = computeDashboard({ videos: [old, recent, fresh], snapshots: onlyLate, accountSnapshots: [], range });
    expect(d.viewsGained).toEqual({ value: 5400, videosCounted: 2, videosWithoutBaseline: 1 });
  });

  it('uses only complete snapshots for engagement rate', () => {
    const d = computeDashboard({ videos: [old, recent, fresh], snapshots, accountSnapshots: [], range: { start: null, end: NOW } });
    // Only "old" has views+likes+comments+shares in its latest views snapshot.
    expect(d.engagement.n).toBe(1);
    expect(d.engagement.rate).toBeCloseTo(700 / 12000, 6);
  });

  it('respects the period end (as-of values for past periods)', () => {
    const d = computeDashboard({
      videos: [old, recent],
      snapshots,
      accountSnapshots: [],
      range: { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-12T00:00:00Z') }
    });
    expect(d.totals.views.sum).toBe(3000);
  });

  it('computes follower change from account snapshots', () => {
    const { range } = resolveRange('30d', NOW);
    const d = computeDashboard({ videos: [], snapshots: [], accountSnapshots: accounts, range });
    expect(d.followers.latest).toBe(1250);
    expect(d.followers.change).toBe(250);
  });

  it('keeps very new videos out of the worst-performing list', () => {
    const d = computeDashboard({ videos: [old, recent, fresh], snapshots, accountSnapshots: [], range: { start: null, end: NOW } });
    expect(d.best[0].video.id).toBe('old');
    expect(d.worst.map((p) => p.video.id)).not.toContain('fresh');
  });

  it('groups performance by category', () => {
    const d = computeDashboard({ videos: [old, recent, fresh], snapshots, accountSnapshots: [], range: { start: null, end: NOW } });
    expect(d.byCategory[0]).toMatchObject({ category: 'First-car advice', medianViews: 12000, count: 1 });
    expect(d.byCategory[1]).toMatchObject({ category: 'Opinions & hot takes', medianViews: 2700, count: 2 });
  });

  it('handles an empty database', () => {
    const d = computeDashboard({ videos: [], snapshots: [], accountSnapshots: [], range: { start: null, end: NOW } });
    expect(d.videosPublished).toBe(0);
    expect(d.medianViews).toBeNull();
    expect(d.engagement.rate).toBeNull();
    expect(d.followers.latest).toBeNull();
  });
});

describe('checkpoints and update queue', () => {
  const v = video({ id: 'cp', published_at: '2026-10-10T18:00:00Z' });

  it('picks the snapshot closest to each checkpoint within its window', () => {
    const list = [
      snap('cp', '2026-10-11T16:00:00Z', { views: 900 }), // 22h
      snap('cp', '2026-10-11T19:00:00Z', { views: 1000 }), // 25h
      snap('cp', '2026-10-13T20:00:00Z', { views: 3000 }) // 74h
    ];
    const values = checkpointValues(v, list);
    expect(values[0].snapshot?.views).toBe(1000);
    expect(values[0].ageHours).toBe(25);
    expect(values[1].snapshot?.views).toBe(3000);
    expect(values[2].snapshot).toBeNull();
  });

  it('marks the next uncovered checkpoint as due, skipping missed windows', () => {
    // 6.75 days old with a 72h snapshot but no 24h snapshot -> 24h missed, 7d due
    const list = [snap('cp', '2026-10-13T20:00:00Z', { views: 3000 })];
    const r = nextReview(v, list, new Date('2026-10-17T12:00:00Z'));
    expect(r.status).toBe('due');
    expect(r.checkpoint?.key).toBe('7d');
    expect(r.missed).toEqual(['24h']);
  });

  it('stops asking for updates once the 30-day window has passed', () => {
    expect(nextReview(v, [], new Date('2026-12-01T12:00:00Z')).status).toBe('complete');
  });

  it('does not schedule historical imports or archived videos', () => {
    expect(nextReview({ ...v, record_type: 'historical_basic' }, [], NOW).status).toBe('not_tracked');
    expect(nextReview({ ...v, tracking_status: 'archived' }, [], NOW).status).toBe('not_tracked');
  });

  it('sorts the queue with due items first', () => {
    const due = video({ id: 'due', published_at: '2026-10-16T10:00:00Z' }); // 26h old → 24h due
    const soon = video({ id: 'soon', published_at: '2026-10-17T00:00:00Z' }); // 12h old → 24h upcoming
    const q = buildUpdateQueue([soon, due], new Map(), NOW);
    expect(q.map((i) => [i.video.id, i.review.status])).toEqual([
      ['due', 'due'],
      ['soon', 'upcoming']
    ]);
  });
});
