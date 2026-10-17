import { describe, expect, it } from 'vitest';
import { supportsServerFallback } from '../src/lib/extraction/extract';
import { extractionSchema } from '../src/lib/extraction/schema';
import { classifyLine, ocrToExtraction, splitDate, type OcrLine } from '../src/lib/ocr-parse';

const ref = new Date('2026-10-16T15:00:00Z');
let y = 0;
const line = (text: string, opts: { y?: number; x0?: number; x1?: number; h?: number } = {}): OcrLine => {
  const top = opts.y ?? (y += 60);
  return { text, x0: opts.x0 ?? 300, x1: opts.x1 ?? 1100, y0: top, y1: top + (opts.h ?? 40) };
};

describe('line classification', () => {
  it('keeps numbers inside titles as part of the title', () => {
    expect(classifyLine('Is 85 horsepower enough for your first car?', ref)).toMatchObject({ title: 'Is 85 horsepower enough for your first car?', counts: [] });
  });
  it('separates dates and counts', () => {
    expect(classifyLine('3d ago · 4,210 88', ref)).toEqual({ title: null, date: '3d ago', counts: ['4,210', '88'] });
    expect(classifyLine('12.3K views', ref)).toEqual({ title: null, date: null, counts: ['12.3K'] });
    expect(splitDate('Posted Oct 12, 2025', ref).date).toBe('Oct 12, 2025');
  });
  it('ignores interface words', () => {
    expect(classifyLine('Posts', ref).title).toBeNull();
  });
});

describe('post list', () => {
  it('builds one entry per row, with views from the first number and other numbers noted', () => {
    y = 0;
    const lines = [
      line('9:41', { y: 20 }),
      line('Posts', { y: 150 }),
      line('Is 85 horsepower enough for your first', { y: 300 }),
      line("car? Here's the truth…", { y: 345 }),
      line('Oct 12', { y: 400 }),
      line('12.3K 456 12', { y: 450 }),
      line('Cheapest cars to insure at 17', { y: 700 }),
      line('3d ago · 4,210 88', { y: 760 }),
      line('POV: first drive in my Fiesta', { y: 2450 })
    ];
    const ext = ocrToExtraction('video_list', lines, { width: 1179, height: 2556 }, ref);
    expect(extractionSchema.safeParse(ext).success).toBe(true);
    expect(ext.videos).toHaveLength(3);
    expect(ext.videos[0]).toMatchObject({
      title_text: "Is 85 horsepower enough for your first car? Here's the truth",
      title_truncated: true,
      published_text: 'Oct 12',
      views_text: '12.3K',
      likes_text: null,
      notes: 'Other numbers on this row: 456, 12'
    });
    expect(ext.videos[1]).toMatchObject({ title_text: 'Cheapest cars to insure at 17', published_text: '3d ago', views_text: '4,210' });
    expect(ext.videos[2]).toMatchObject({ title_text: 'POV: first drive in my Fiesta', views_text: null, partially_visible: true });
    expect(ext.videos.every((v) => v.uncertain_fields.includes('views'))).toBe(true);
    expect(ext.ocr_lines).toContain('Cheapest cars to insure at 17');
    expect(ext.warnings[0]).toMatch(/check every value/);
  });

  it('warns when nothing looks like a video row', () => {
    const ext = ocrToExtraction('video_list', [line('Posts', { y: 100 })], { width: 1000, height: 2000 }, ref);
    expect(ext.videos).toEqual([]);
    expect(ext.warnings.join(' ')).toMatch(/No video rows/);
  });
});

describe('single video analytics', () => {
  it('pairs labels with values on the same line or the nearest line', () => {
    const lines = [
      line('Posted Oct 12, 2025', { y: 200 }),
      line('15.4K', { y: 400, x0: 100, x1: 400 }),
      line('Video views', { y: 450, x0: 100, x1: 400 }),
      line('1,204', { y: 400, x0: 700, x1: 1000 }),
      line('Likes', { y: 450, x0: 700, x1: 1000 }),
      line('Average watch time 8.2s', { y: 800 }),
      line('Watched full video 18.5%', { y: 860 }),
      line('New followers 34', { y: 920 }),
      line('For You 91.2%', { y: 1200 }),
      line('Personal profile 4.1%', { y: 1260 }),
      line('Most viewers stopped watching at 0:04', { y: 1400 })
    ];
    const ext = ocrToExtraction('video_analytics', lines, { width: 1179, height: 2556 }, ref);
    expect(extractionSchema.safeParse(ext).success).toBe(true);
    expect(ext.videos[0]).toMatchObject({ views_text: '15.4K', likes_text: '1,204', published_text: 'Oct 12, 2025', title_text: null });
    expect(ext.video_detail).toMatchObject({
      avg_watch_time_text: '8.2s',
      full_watch_rate_text: '18.5%',
      new_followers_text: '34',
      traffic_sources: [
        { source: 'For You', percent_text: '91.2%' },
        { source: 'Personal profile', percent_text: '4.1%' }
      ],
      retention_notes: 'Most viewers stopped watching at 0:04'
    });
  });
});

describe('account overview', () => {
  it('reads followers, period and totals without confusing net followers', () => {
    const lines = [
      line('Last 7 days', { y: 100 }),
      line('Followers 1,520', { y: 300 }),
      line('Net followers -12', { y: 360 }),
      line('Post views 48.2K', { y: 420 }),
      line('Profile views 2,031', { y: 480 })
    ];
    const ext = ocrToExtraction('account_overview', lines, { width: 1179, height: 2556 }, ref);
    expect(ext.account).toMatchObject({
      followers_text: '1,520',
      period_followers_change_text: '-12',
      period_views_text: '48.2K',
      period_profile_views_text: '2,031',
      period_label: 'Last 7 days'
    });
  });
});

describe('model options', () => {
  it('only requests server-side fallback on models that support it', () => {
    expect(supportsServerFallback('claude-haiku-5-5')).toBe(false);
    expect(supportsServerFallback('claude-opus-5-5')).toBe(true);
    expect(supportsServerFallback('claude-sonnet-5-5')).toBe(true);
  });
});
