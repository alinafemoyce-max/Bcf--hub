import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/lib/db/client';
import { migrate } from '../src/lib/db/migrate';
import { ConflictError, UserError } from '../src/lib/errors';
import { addAccountSnapshot, listAccountSnapshots } from '../src/lib/repo/account';
import { createIdea, listIdeas, updateIdea } from '../src/lib/repo/ideas';
import {
  confirmScreenshot,
  createScreenshot,
  deleteScreenshot,
  getScreenshot,
  getScreenshotImage,
  saveExtraction,
  sniffImageType
} from '../src/lib/repo/screenshots';
import { deleteAllData, exportAll, getSettings, updateSettings } from '../src/lib/repo/settings';
import { addSnapshot, createVideo, deleteVideo, getVideo, listMatchCandidates, listSnapshots, listVideos, updateVideo } from '../src/lib/repo/videos';
import type { Extraction } from '../src/lib/extraction/schema';
import type { ConfirmEntry, ConfirmPayload } from '../src/lib/validation';
import { testDb } from './helpers/db';

// Smallest valid PNG header bytes followed by unique content, so each "image" hashes differently.
const png = (tag: string) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(tag)]);

const extraction = (titles: string[]): Extraction => ({
  is_tiktok_screen: true,
  screen_description: 'TikTok Studio posts list',
  observed_date_text: null,
  videos: titles.map((t, i) => ({
    title_text: t,
    title_truncated: false,
    published_text: `Oct ${i + 1}`,
    views_text: `${i + 1}.2K`,
    likes_text: null,
    comments_text: null,
    shares_text: null,
    saves_text: null,
    duration_text: null,
    tiktok_url_or_id: null,
    thumbnail_box: null,
    partially_visible: false,
    uncertain_fields: [],
    notes: null
  })),
  video_detail: null,
  account: null,
  warnings: []
});

const entry = (over: Partial<ConfirmEntry>): ConfirmEntry => ({
  include: true,
  action: 'create',
  video_id: null,
  title: 'Untitled',
  title_truncated: false,
  tiktok_url: null,
  published_at: '2026-10-01T11:00:00.000Z',
  published_at_precision: 'date',
  views: 1200,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  approximate_fields: ['views'],
  thumbnail_data: null,
  ...over
});

const payload = (entries: ConfirmEntry[], observed = '2026-10-16T12:00:00.000Z'): ConfirmPayload => ({
  observed_at: observed,
  observed_at_source: 'user',
  entries
});

let db: Db;
beforeAll(async () => {
  db = await testDb();
});
afterAll(async () => {
  await db.close();
});

describe('migrations', () => {
  it('are idempotent', async () => {
    expect(await migrate(db)).toEqual([]);
  });
});

describe('videos and snapshots', () => {
  it('creates, updates and lists videos', async () => {
    const v = await createVideo(db, {
      title: 'Is 85 horsepower enough for your first car?',
      tiktok_url: 'https://www.tiktok.com/@ajm/video/7351234567890123456',
      published_at: '2026-09-01T17:30:00.000Z',
      hashtags: ['#FirstCar', 'carTok carTok'],
      category: 'First-car advice',
      on_camera: true
    });
    expect(v.tiktok_video_id).toBe('7351234567890123456');
    expect(v.hashtags).toEqual(['firstcar', 'cartok']);
    expect(v.record_type).toBe('tracked');
    expect(v.published_at_precision).toBe('datetime');
    const u = await updateVideo(db, v.id, { topic: 'Horsepower', tracking_status: 'archived' });
    expect(u.topic).toBe('Horsepower');
    expect(u.tracking_status).toBe('archived');
    expect(u.on_camera).toBe(true);
    expect((await listVideos(db)).length).toBeGreaterThan(0);
  });

  it('rejects a second video with the same TikTok link', async () => {
    await expect(
      createVideo(db, { title: 'Dup', tiktok_url: 'https://www.tiktok.com/@ajm/video/7351234567890123456' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects TikTok links without a video id', async () => {
    await expect(createVideo(db, { title: 'Bad link', tiktok_url: 'https://www.tiktok.com/@ajm' })).rejects.toBeInstanceOf(UserError);
  });

  it('stores every snapshot separately and skips exact duplicates', async () => {
    const v = await createVideo(db, { title: 'Snapshot test', published_at: '2026-10-01T12:00:00.000Z' });
    const a = await addSnapshot(db, v.id, { captured_at: '2026-10-02T12:00:00.000Z', views: 1000, likes: 50 });
    const b = await addSnapshot(db, v.id, { captured_at: '2026-10-04T12:00:00.000Z', views: 2500, likes: 90 });
    const dup = await addSnapshot(db, v.id, { captured_at: '2026-10-04T13:00:00.000Z', views: 2500 });
    expect(a.snapshot && b.snapshot).toBeTruthy();
    expect(dup.snapshot).toBeNull();
    expect(dup.duplicateOf?.id).toBe(b.snapshot!.id);
    const list = await listSnapshots(db, v.id);
    expect(list.map((s) => s.views)).toEqual([1000, 2500]);
    expect(typeof list[0].views).toBe('number');
  });

  it('cascades snapshots when a video is deleted', async () => {
    const v = await createVideo(db, { title: 'To delete' });
    await addSnapshot(db, v.id, { captured_at: '2026-10-02T12:00:00.000Z', views: 5 });
    await deleteVideo(db, v.id);
    expect(await getVideo(db, v.id)).toBeNull();
    expect(await listSnapshots(db, v.id)).toEqual([]);
  });
});

describe('screenshot import', () => {
  it('validates file type by content', () => {
    expect(sniffImageType(png('x'))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new TextEncoder().encode('<svg></svg>'))).toBeNull();
  });

  it('refuses non-images', async () => {
    await expect(
      createScreenshot(db, { kind: 'video_list', filename: 'x.png', bytes: new TextEncoder().encode('hello'), width: 1, height: 1, observedAt: null, observedAtSource: null })
    ).rejects.toThrow(/Unsupported file/);
  });

  it('detects the same file uploaded twice', async () => {
    const first = await createScreenshot(db, { kind: 'video_list', filename: 'a.png', bytes: png('same'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const second = await createScreenshot(db, { kind: 'video_list', filename: 'b.png', bytes: png('same'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.screenshot.id).toBe(first.screenshot.id);
  });

  it('imports a list screenshot as historical basic records with provenance, then deletes the image', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'list1.png', bytes: png('list1'), width: 1179, height: 2556, observedAt: null, observedAtSource: null });
    await saveExtraction(db, screenshot.id, extraction(['Cheapest cars to insure at 17', 'My first car tour']), 'claude-test');
    const summary = await confirmScreenshot(
      db,
      screenshot.id,
      payload([
        entry({ title: 'Cheapest cars to insure at 17', views: 1200 }),
        entry({ title: 'My first car tour', views: 2200, published_at: '2026-10-02T11:00:00.000Z' })
      ]),
      { keepImage: false }
    );
    expect(summary).toMatchObject({ snapshotsAdded: 2, duplicatesSkipped: 0 });
    expect(summary.createdVideoIds).toHaveLength(2);
    const v = (await getVideo(db, summary.createdVideoIds[0]))!;
    expect(v.record_type).toBe('historical_basic');
    expect(v.source).toBe('screenshot_import');
    const snaps = await listSnapshots(db, v.id);
    expect(snaps[0]).toMatchObject({ screenshot_id: screenshot.id, source: 'screenshot', captured_at: '2026-10-16T12:00:00.000Z', approximate_fields: ['views'] });
    const after = (await getScreenshot(db, screenshot.id))!;
    expect(after.status).toBe('confirmed');
    expect(after.has_image).toBe(false);
    expect(await getScreenshotImage(db, screenshot.id)).toBeNull();
  });

  it('refuses to import the same screenshot twice', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'twice.png', bytes: png('twice'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await confirmScreenshot(db, screenshot.id, payload([entry({ title: 'Twice video' })]), { keepImage: true });
    await expect(confirmScreenshot(db, screenshot.id, payload([entry({ title: 'Twice video' })]), { keepImage: true })).rejects.toBeInstanceOf(ConflictError);
    expect((await getScreenshot(db, screenshot.id))!.has_image).toBe(true);
  });

  it('adds a newer screenshot of an existing video as a new snapshot instead of a new video', async () => {
    const candidates = await listMatchCandidates(db);
    const existing = candidates.find((c) => c.title === 'Cheapest cars to insure at 17')!;
    const before = (await listVideos(db)).length;
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'list2.png', bytes: png('list2'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const summary = await confirmScreenshot(
      db,
      screenshot.id,
      payload([entry({ action: 'match', video_id: existing.id, title: 'Cheapest cars to insure at 17', views: 4100, approximate_fields: [] })], '2026-10-20T12:00:00.000Z'),
      { keepImage: false }
    );
    expect(summary.createdVideoIds).toHaveLength(0);
    expect(summary.snapshotsAdded).toBe(1);
    expect((await listVideos(db)).length).toBe(before);
    expect((await listSnapshots(db, existing.id)).map((s) => s.views)).toEqual([1200, 4100]);
  });

  it('skips the duplicate observation when overlapping screenshots show the same numbers', async () => {
    const existing = (await listMatchCandidates(db)).find((c) => c.title === 'My first car tour')!;
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'overlap.png', bytes: png('overlap'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const summary = await confirmScreenshot(
      db,
      screenshot.id,
      payload([entry({ action: 'match', video_id: existing.id, title: 'My first car tour', views: 2200 })], '2026-10-16T12:20:00.000Z'),
      { keepImage: false }
    );
    expect(summary).toMatchObject({ snapshotsAdded: 0, duplicatesSkipped: 1 });
  });

  it('blocks creating a new video that looks like an existing one unless confirmed', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'guard.png', bytes: png('guard'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const p = payload([entry({ title: 'Cheapest cars to insure at 17', published_at: '2026-10-01T11:00:00.000Z' })]);
    await expect(confirmScreenshot(db, screenshot.id, p, { keepImage: false })).rejects.toBeInstanceOf(ConflictError);
    // Nothing was saved by the failed attempt.
    expect((await getScreenshot(db, screenshot.id))!.status).toBe('uploaded');
    p.entries[0].confirmed_new = true;
    const summary = await confirmScreenshot(db, screenshot.id, p, { keepImage: false });
    expect(summary.createdVideoIds).toHaveLength(1);
  });

  it('rejects two entries matched to the same video', async () => {
    const existing = (await listMatchCandidates(db))[0];
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'same2.png', bytes: png('same2'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await expect(
      confirmScreenshot(
        db,
        screenshot.id,
        payload([entry({ action: 'match', video_id: existing.id }), entry({ action: 'match', video_id: existing.id })]),
        { keepImage: false }
      )
    ).rejects.toThrow(/same video/);
  });

  it('imports a single-video analytics screenshot as a detailed snapshot', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'video_analytics', filename: 'detail.png', bytes: png('detail'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const summary = await confirmScreenshot(
      db,
      screenshot.id,
      {
        ...payload([entry({ title: 'Corsa vs Fiesta: which is better?', views: 15400, likes: 1200, comments: 85, shares: 40, saves: 210, approximate_fields: ['views'] })]),
        detail: {
          avg_watch_time_seconds: 8.2,
          total_play_time_seconds: 126000,
          completion_rate: 18.5,
          new_followers: 34,
          traffic_sources: [{ source: 'For You', percent: 91.2 }],
          retention: 'Most viewers stopped watching at 0:04'
        }
      },
      { keepImage: false }
    );
    const v = (await getVideo(db, summary.createdVideoIds[0]))!;
    expect(v.record_type).toBe('tracked');
    const [s] = await listSnapshots(db, v.id);
    expect(s).toMatchObject({ completeness: 'detailed', avg_watch_time_seconds: 8.2, completion_rate: 18.5, saves: 210, traffic_sources: [{ source: 'For You', percent: 91.2 }] });
    expect((await getScreenshot(db, screenshot.id))!.target_video_id).toBe(v.id);
  });

  it('stores account overview screenshots as account-level snapshots', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'account_overview', filename: 'acct.png', bytes: png('acct'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await confirmScreenshot(
      db,
      screenshot.id,
      { ...payload([]), account: { captured_at: '2026-10-16T12:00:00.000Z', followers: 1520, period_label: 'Last 7 days', period_days: 7, period_views: 48200, approximate_fields: ['period_views'] } },
      { keepImage: false }
    );
    const list = await listAccountSnapshots(db);
    expect(list.at(-1)).toMatchObject({ followers: 1520, period_views: 48200, screenshot_id: screenshot.id, source: 'screenshot' });
  });

  it('deletes a screenshot with its snapshots, and optionally the videos it created', async () => {
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'del.png', bytes: png('del'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const summary = await confirmScreenshot(db, screenshot.id, payload([entry({ title: 'Delete me with the screenshot', published_at: '2026-09-09T11:00:00.000Z' })]), { keepImage: false });
    const videoId = summary.createdVideoIds[0];
    const res = await deleteScreenshot(db, screenshot.id, { deleteCreatedVideos: true });
    expect(res.deletedVideos).toBe(1);
    expect(await getVideo(db, videoId)).toBeNull();
    expect(await getScreenshot(db, screenshot.id)).toBeNull();
  });
});

describe('ideas, settings, account and export', () => {
  it('manages ideas and links them to videos', async () => {
    const v = (await listVideos(db))[0];
    const idea = await createIdea(db, { title: 'Is 90hp enough?' });
    expect(idea.status).toBe('new');
    const up = await updateIdea(db, idea.id, { status: 'published', video_id: v.id });
    expect(up).toMatchObject({ status: 'published', video_id: v.id });
    expect((await listIdeas(db)).some((i) => i.id === idea.id)).toBe(true);
  });

  it('stores settings', async () => {
    expect((await getSettings(db)).keepScreenshots).toBe(false);
    expect((await updateSettings(db, { keepScreenshots: true })).keepScreenshots).toBe(true);
  });

  it('exports data without image bytes, and can delete everything', async () => {
    await addAccountSnapshot(db, { captured_at: '2026-10-01T12:00:00.000Z', followers: 1000 });
    const data = await exportAll(db);
    expect(data.videos.length).toBeGreaterThan(0);
    expect(JSON.stringify(data.screenshots)).not.toContain('image_data');
    await deleteAllData(db);
    expect(await listVideos(db)).toEqual([]);
  });
});
