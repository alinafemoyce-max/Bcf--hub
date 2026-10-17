import { describe, expect, it } from 'vitest';
import { contentFingerprint, findMatches, normaliseTitle, titleSimilarity } from '../src/lib/matching';
import type { MatchCandidate } from '../src/lib/types';

const cand = (over: Partial<MatchCandidate>): MatchCandidate => ({
  id: over.id ?? 'v1',
  title: 'Is 85 horsepower enough for your first car?',
  title_truncated: false,
  tiktok_video_id: null,
  published_at: '2026-09-01T11:00:00.000Z',
  published_at_precision: 'date',
  latest_views: 1000,
  latest_captured_at: null,
  thumbnail_data: null,
  ...over
});

describe('title similarity', () => {
  it('normalises punctuation, emoji and ellipses', () => {
    expect(normaliseTitle('Is 85 HP enough?! 🚗 #firstcar…')).toBe('is 85 hp enough firstcar');
  });
  it('treats a truncated prefix as a strong match', () => {
    expect(titleSimilarity('Is 85 horsepower enough for', 'Is 85 horsepower enough for your first car?', true, false)).toBeGreaterThan(0.95);
  });
  it('does not treat a short truncated prefix as certain', () => {
    expect(titleSimilarity('Is 85', 'Is 85 horsepower enough for your first car?', true)).toBeLessThan(0.9);
  });
  it('scores different videos low', () => {
    expect(titleSimilarity('Best used cars under £3000', 'Is 85 horsepower enough for your first car?')).toBeLessThan(0.5);
  });
});

describe('findMatches', () => {
  const library = [
    cand({ id: 'a' }),
    cand({ id: 'b', title: 'Best used cars under £3000', published_at: '2026-09-10T11:00:00.000Z' }),
    cand({ id: 'c', title: 'POV: driving my Fiesta at night', tiktok_video_id: '7351234567890123456' })
  ];

  it('matches on TikTok id with certainty, regardless of title', () => {
    const m = findMatches({ title: 'something else', tiktokVideoId: '7351234567890123456' }, library);
    expect(m[0]).toMatchObject({ level: 'exact_id', candidate: { id: 'c' } });
  });

  it('rates an identical title on the same date as likely', () => {
    const m = findMatches({ title: 'Is 85 horsepower enough for your first car?', publishedAt: '2026-09-01T11:00:00.000Z' }, library);
    expect(m[0]).toMatchObject({ level: 'likely', candidate: { id: 'a' } });
  });

  it('downgrades a same-title video posted weeks apart (could be a re-upload or follow-up)', () => {
    const m = findMatches({ title: 'Is 85 horsepower enough for your first car?', publishedAt: '2026-10-10T11:00:00.000Z' }, library);
    expect(m[0].level).toBe('possible');
  });

  it('does not match a related but different idea as the same video', () => {
    const m = findMatches({ title: 'Is 90 horsepower too slow for a new driver?', publishedAt: '2026-10-10T11:00:00.000Z' }, library);
    expect(m.every((x) => x.level !== 'likely')).toBe(true);
  });

  it('returns nothing for unrelated titles', () => {
    expect(findMatches({ title: 'Insurance hacks for 17 year olds' }, library)).toEqual([]);
  });
});

describe('contentFingerprint', () => {
  it('is order-independent and ignores whitespace', () => {
    const a = contentFingerprint([
      { title: 'Video A', views: '1.2K', published: 'Oct 1' },
      { title: 'Video B', views: '900', published: 'Oct 3' }
    ]);
    const b = contentFingerprint([
      { title: 'Video B', views: '900 ', published: 'oct 3' },
      { title: 'video a!', views: '1.2K', published: 'Oct 1' }
    ]);
    expect(a).toBe(b);
    expect(contentFingerprint([])).toBeNull();
  });
});
