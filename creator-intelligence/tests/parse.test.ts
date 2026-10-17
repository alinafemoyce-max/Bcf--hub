import { describe, expect, it } from 'vitest';
import { localToUtc, parseCount, parseDuration, parsePercent, parsePublishedText, parseTikTokVideoId, toLocalParts } from '../src/lib/parse';

describe('parseCount', () => {
  it('reads exact numbers', () => {
    expect(parseCount('1,234')).toEqual({ value: 1234, approximate: false });
    expect(parseCount('987')).toEqual({ value: 987, approximate: false });
    expect(parseCount('1 204 views')).toEqual({ value: 1204, approximate: false });
    expect(parseCount('0')).toEqual({ value: 0, approximate: false });
  });
  it('marks abbreviated numbers as approximate', () => {
    expect(parseCount('12.3K')).toEqual({ value: 12300, approximate: true });
    expect(parseCount('12K')).toEqual({ value: 12000, approximate: true });
    expect(parseCount('1.2M')).toEqual({ value: 1200000, approximate: true });
    expect(parseCount('12,3K')).toEqual({ value: 12300, approximate: true });
    expect(parseCount('2.5m views')).toEqual({ value: 2500000, approximate: true });
  });
  it('returns null for missing or unreadable values instead of guessing', () => {
    for (const v of [null, undefined, '', '-', '--', '—', 'N/A', 'abc', '12..3K', '1.5']) expect(parseCount(v as string)).toBeNull();
  });
});

describe('parsePercent / parseDuration', () => {
  it('parses percentages', () => {
    expect(parsePercent('23.4%')).toBe(23.4);
    expect(parsePercent('23,4 %')).toBe(23.4);
    expect(parsePercent('140%')).toBeNull();
    expect(parsePercent('23.4')).toBeNull();
  });
  it('parses durations and watch times', () => {
    expect(parseDuration('0:45')).toBe(45);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('8.2s')).toBe(8.2);
    expect(parseDuration('1m 5s')).toBe(65);
    expect(parseDuration('2h 3min')).toBe(7380);
    expect(parseDuration('12 seconds')).toBe(12);
    expect(parseDuration('about 5')).toBeNull();
    expect(parseDuration('-')).toBeNull();
  });
});

describe('parsePublishedText', () => {
  // 16 Oct 2026 15:00 UTC = 16:00 BST
  const ref = new Date('2026-10-16T15:00:00Z');

  it('handles relative times', () => {
    expect(parsePublishedText('3h ago', ref)).toMatchObject({ iso: '2026-10-16T12:00:00.000Z', precision: 'datetime' });
    expect(parsePublishedText('2d ago', ref)).toMatchObject({ localDate: '2026-10-14', precision: 'date' });
    expect(parsePublishedText('1w ago', ref)).toMatchObject({ localDate: '2026-10-09', precision: 'date' });
    expect(parsePublishedText('Yesterday', ref)).toMatchObject({ localDate: '2026-10-15' });
    expect(parsePublishedText('5 days ago', ref)).toMatchObject({ localDate: '2026-10-11' });
  });

  it('handles month names and infers the year from the screenshot date', () => {
    expect(parsePublishedText('Oct 12', ref)).toMatchObject({ localDate: '2026-10-12', precision: 'date' });
    expect(parsePublishedText('12 Oct', ref)).toMatchObject({ localDate: '2026-10-12' });
    // December is after the reference date, so it must be last year.
    expect(parsePublishedText('Dec 24', ref)).toMatchObject({ localDate: '2025-12-24' });
    expect(parsePublishedText('October 3, 2025', ref)).toMatchObject({ localDate: '2025-10-03' });
    expect(parsePublishedText('3rd Sept 2025', ref)).toMatchObject({ localDate: '2025-09-03' });
  });

  it('handles numeric formats (UK day/month order) and flags ambiguity', () => {
    expect(parsePublishedText('2025-10-12', ref)).toMatchObject({ localDate: '2025-10-12', ambiguous: false });
    expect(parsePublishedText('12/10/2025', ref)).toMatchObject({ localDate: '2025-10-12', ambiguous: true });
    expect(parsePublishedText('25/10/2025', ref)).toMatchObject({ localDate: '2025-10-25', ambiguous: false });
    expect(parsePublishedText('10-12', ref)).toMatchObject({ localDate: '2026-10-12', ambiguous: true });
  });

  it('keeps a visible time and converts London time to UTC', () => {
    const p = parsePublishedText('12 Oct 2026, 18:30', ref);
    expect(p).toMatchObject({ precision: 'datetime', localTime: '18:30', iso: '2026-10-12T17:30:00.000Z' });
    const winter = parsePublishedText('Jan 5 2026 at 6:30 pm', ref);
    expect(winter).toMatchObject({ iso: '2026-01-05T18:30:00.000Z' });
  });

  it('rejects text it cannot read', () => {
    expect(parsePublishedText('sometime', ref)).toBeNull();
    expect(parsePublishedText('31/02/2025', ref)).toBeNull();
    expect(parsePublishedText(null, ref)).toBeNull();
  });
});

describe('time zones and ids', () => {
  it('converts across BST boundaries', () => {
    expect(localToUtc('2026-07-01', '12:00').toISOString()).toBe('2026-07-01T11:00:00.000Z');
    expect(localToUtc('2026-12-01', '12:00').toISOString()).toBe('2026-12-01T12:00:00.000Z');
    expect(toLocalParts(new Date('2026-07-01T23:30:00Z'))).toEqual({ date: '2026-07-02', time: '00:30' });
  });
  it('extracts TikTok video ids', () => {
    expect(parseTikTokVideoId('https://www.tiktok.com/@ajm/video/7351234567890123456?lang=en')).toBe('7351234567890123456');
    expect(parseTikTokVideoId('7351234567890123456')).toBe('7351234567890123456');
    expect(parseTikTokVideoId('https://vm.tiktok.com/ZMabc123/')).toBeNull();
  });
});
