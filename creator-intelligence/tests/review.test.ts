import { describe, expect, it } from 'vitest';
import type { Extraction } from '../src/lib/extraction/schema';
import { filterLibrary } from '../src/lib/library';
import { blankEntry, initialAccount, initialEntries, toConfirmAccount, toConfirmDetail, toConfirmEntry, withParsedDate } from '../src/lib/review';
import type { MatchCandidate, Video } from '../src/lib/types';

const observed = new Date('2026-10-16T15:00:00Z');

const ext = (rows: Partial<Extraction['videos'][number]>[]): Extraction => ({
  is_tiktok_screen: true,
  screen_description: 'list',
  observed_date_text: null,
  videos: rows.map((r) => ({
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
    ...r
  })),
  video_detail: null,
  account: null,
  warnings: []
});

const library: MatchCandidate[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Is 85 horsepower enough for your first car?',
    title_truncated: false,
    tiktok_video_id: null,
    published_at: '2026-10-12T11:00:00.000Z',
    published_at_precision: 'date',
    latest_views: 9000,
    latest_captured_at: null,
    thumbnail_data: null
  }
];

describe('initialEntries', () => {
  it('pre-selects likely matches, defaults unknown videos to new, and parses dates from the screenshot time', () => {
    const entries = initialEntries({
      extraction: ext([
        { title_text: 'Is 85 horsepower enough for your', title_truncated: true, published_text: 'Oct 12', views_text: '12.3K' },
        { title_text: 'Best cars under £2000', published_text: '2d ago', views_text: '800' }
      ]),
      kind: 'video_list',
      observedAt: observed,
      candidates: library,
      targetVideoId: null
    });
    expect(entries[0].decision).toEqual({ videoId: library[0].id });
    expect(entries[0].date).toBe('2026-10-12');
    expect(entries[1].decision).toBe('new');
    expect(entries[1].date).toBe('2026-10-14');
  });

  it('requires an explicit choice for a merely possible match', () => {
    const [e] = initialEntries({
      extraction: ext([{ title_text: 'Is 85 horsepower enough for your first car?', published_text: 'Sep 1', views_text: '100' }]),
      kind: 'video_list',
      observedAt: observed,
      candidates: library,
      targetVideoId: null
    });
    expect(e.decision).toBeNull();
    expect(toConfirmEntry(e, null)).toMatchObject({ ok: false });
  });

  it('skips empty rows and targets the chosen video for analytics screenshots', () => {
    const list = initialEntries({ extraction: ext([{}]), kind: 'video_list', observedAt: observed, candidates: [], targetVideoId: null });
    expect(list[0].include).toBe(false);
    const detail = initialEntries({ extraction: null, kind: 'video_analytics', observedAt: observed, candidates: library, targetVideoId: library[0].id });
    expect(detail).toHaveLength(1);
    expect(detail[0].decision).toEqual({ videoId: library[0].id });
  });

  it('re-derives relative dates when the screenshot time is corrected, but keeps user edits', () => {
    const e = blankEntry({ publishedText: '1d ago' });
    expect(withParsedDate(e, observed).date).toBe('2026-10-15');
    expect(withParsedDate(e, new Date('2026-10-01T12:00:00Z')).date).toBe('2026-09-30');
    expect(withParsedDate({ ...e, date: '2026-01-01', dateTouched: true }, observed).date).toBe('2026-01-01');
  });
});

describe('toConfirmEntry', () => {
  it('converts visible text to numbers and records approximations', () => {
    const r = toConfirmEntry(blankEntry({ title: 'A', views: '12.3K', likes: '1,204', date: '2026-10-12', time: '18:30' }), null);
    expect(r).toMatchObject({
      ok: true,
      entry: { action: 'create', views: 12300, likes: 1204, approximate_fields: ['views'], published_at: '2026-10-12T17:30:00.000Z', published_at_precision: 'datetime' }
    });
  });

  it('refuses unreadable numbers instead of guessing', () => {
    expect(toConfirmEntry(blankEntry({ title: 'A', views: '12,3,4K' }), null)).toMatchObject({ ok: false });
  });

  it('marks an explicit "new" choice so the server does not block it', () => {
    const r = toConfirmEntry(blankEntry({ title: 'A', decision: 'new', autoDecision: false }), null);
    expect(r.ok && r.entry.confirmed_new).toBe(true);
  });

  it('only sends a thumbnail when the user keeps it', () => {
    const r = toConfirmEntry(blankEntry({ title: 'A', useThumbnail: false }), 'data:image/jpeg;base64,AAAA');
    expect(r.ok && r.entry.thumbnail_data).toBeNull();
  });
});

describe('detail and account conversion', () => {
  it('parses detailed analytics', () => {
    const r = toConfirmDetail({ avg: '8.2s', total: '35h 2m', full: '18.5%', followers: '+34', traffic: [{ source: 'For You', percent: '91.2%' }], retention: '' });
    expect(r).toMatchObject({ ok: true, detail: { avg_watch_time_seconds: 8.2, total_play_time_seconds: 126120, completion_rate: 18.5, new_followers: 34, traffic_sources: [{ source: 'For You', percent: 91.2 }] } });
    expect(toConfirmDetail({ avg: 'soon', total: '', full: '', followers: '', traffic: [], retention: '' }).ok).toBe(false);
  });

  it('parses account figures, including negative follower change', () => {
    const a = initialAccount({
      followers_text: '1,520',
      total_likes_text: null,
      period_label: 'Last 7 days',
      period_views_text: '48.2K',
      period_profile_views_text: null,
      period_likes_text: null,
      period_comments_text: null,
      period_shares_text: null,
      period_followers_change_text: '-12'
    });
    expect(a.periodDays).toBe('7');
    const r = toConfirmAccount(a, '2026-10-16T12:00:00.000Z');
    expect(r).toMatchObject({ ok: true, account: { followers: 1520, period_views: 48200, period_followers_change: -12, approximate_fields: ['period_views'] } });
  });
});

describe('filterLibrary', () => {
  const v = (id: string, over: Partial<Video>): Video =>
    ({
      id,
      title: id,
      title_truncated: false,
      tiktok_video_id: null,
      tiktok_url: null,
      published_at: '2026-10-01T12:00:00.000Z',
      published_at_precision: 'date',
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
      created_at: '',
      updated_at: '',
      ...over
    }) as Video;
  const videos = [
    v('fiesta review', { category: 'Reviews & comparisons', duration_seconds: 45 }),
    v('insurance tips', { category: 'First-car advice', duration_seconds: 12, hashtags: ['insurance'] }),
    v('pov drive', { format: 'POV driving', published_at: '2026-08-01T12:00:00.000Z' })
  ];
  const snaps = new Map([
    ['fiesta review', [{ video_id: 'fiesta review', captured_at: '2026-10-05T00:00:00.000Z', views: 5000, approximate_fields: [] }]],
    ['insurance tips', [{ video_id: 'insurance tips', captured_at: '2026-10-05T00:00:00.000Z', views: 100, approximate_fields: [] }]]
  ]) as never;
  const now = new Date('2026-10-17T00:00:00Z');

  it('searches, filters and sorts', () => {
    expect(filterLibrary(videos, snaps, { q: 'insurance' }, now).map((r) => r.video.id)).toEqual(['insurance tips']);
    expect(filterLibrary(videos, snaps, { dur: 'short' }, now).map((r) => r.video.id)).toEqual(['insurance tips']);
    expect(filterLibrary(videos, snaps, { from: '2026-09-01' }, now)).toHaveLength(2);
    expect(filterLibrary(videos, snaps, { perf: 'none' }, now).map((r) => r.video.id)).toEqual(['pov drive']);
    expect(filterLibrary(videos, snaps, { sort: 'views' }, now)[0].video.id).toBe('fiesta review');
    expect(filterLibrary(videos, snaps, { category: 'none' }, now).map((r) => r.video.id)).toEqual(['pov drive']);
  });
});
