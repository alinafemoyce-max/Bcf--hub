import { describe, expect, it } from 'vitest';
import { computePersonalRecords, consistencyPercent, estimate1RM, exerciseSeries, personalRecordEvents, prsSetInSession, weekStats } from '@/domain/analytics';
import { buildReminders, weeklyReview } from '@/domain/reminders';
import { defaultProgramme } from '@/data/seed';
import { NOW, exerciseMap, ex, lifts, session, set } from './helpers';

const P = { sets: 3, repsMin: 10, repsMax: 12 };
const templates = defaultProgramme(NOW);
const MON_TO_FRI = [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[];

describe('personal records', () => {
  const exercises = exerciseMap();
  const s1 = session('2026-10-05', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);
  const s2 = session('2026-10-12', 'bi_lat_pulldown', lifts(32.5, [10, 10, 9]), P);
  const s3 = session('2026-10-15', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);

  it('first performance is a baseline, not a "new record"', () => {
    expect(prsSetInSession([s1], s1.id, exercises)).toEqual([]);
  });

  it('records a PR in the session that beat the previous best, and keeps it after later sessions', () => {
    const all = [s1, s2, s3];
    const kinds = prsSetInSession(all, s2.id, exercises).map((p) => p.kind);
    expect(kinds).toContain('heaviest_weight');
    expect(prsSetInSession(all, s3.id, exercises)).toEqual([]);
    expect(personalRecordEvents(all, exercises).every((p) => p.sessionId === s2.id)).toBe(true);
  });

  it('sprint PRs are the fastest time; jumps with poor landings never count', () => {
    const t1 = session('2026-10-09', 'bi_sprint_10m', [set({ time: 1.9, dist: 10 })], { sets: 1, distanceM: 10 }, { loadMode: 'none' });
    const t2 = session('2026-10-16', 'bi_sprint_10m', [set({ time: 1.85, dist: 10 })], { sets: 1, distanceM: 10 }, { loadMode: 'none' });
    const j = session('2026-10-16', 'bi_broad_jump', [set({ dist: 2.6, t: 'poor' }), set({ dist: 2.3 })], { sets: 2, repsMin: 3, repsMax: 3 }, { loadMode: 'none', id: 'j' });
    const prs = computePersonalRecords([t1, t2, j], exercises);
    expect(prs.find((p) => p.kind === 'fastest_time')?.value).toBe(1.85);
    expect(prs.find((p) => p.kind === 'longest_jump')?.value).toBe(2.3);
  });
});

describe('estimates and series', () => {
  it('Epley e1RM only for 1–12 reps', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(30, 12)).toBeCloseTo(42);
    expect(estimate1RM(30, 15)).toBeNull();
  });

  it('charts each load mode separately', () => {
    const bench = ex('db_bench_press');
    const a = session('2026-10-05', bench.id, lifts(16, [10, 10, 10]), P, { loadMode: 'per_dumbbell' });
    const b = session('2026-10-07', bench.id, lifts(32, [10, 10, 10]), P, { loadMode: 'total', id: 'b' });
    expect(exerciseSeries([a, b], bench, 'per_dumbbell').map((p) => p.topWeightKg)).toEqual([16]);
    expect(exerciseSeries([a, b], bench, 'total').map((p) => p.topWeightKg)).toEqual([32]);
  });
});

describe('consistency', () => {
  it('does not count days before tracking began, or today before it is trained', () => {
    // Onboarded Monday 19 Oct; nothing is "missed" yet.
    expect(consistencyPercent([], '2026-10-19', 4, templates, MON_TO_FRI, '2026-10-19')).toBeNull();
    const mon = session('2026-10-19', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);
    expect(consistencyPercent([mon], '2026-10-19', 4, templates, MON_TO_FRI, '2026-10-19')).toBe(100);
    // Tuesday not trained, now Wednesday → 1 of 2 planned days so far.
    expect(consistencyPercent([mon], '2026-10-21', 4, templates, MON_TO_FRI, '2026-10-19')).toBe(50);
  });

  it('weekly stats count training days and volume', () => {
    const mon = session('2026-10-19', 'bi_lat_pulldown', lifts(30, [10, 10]), P);
    const w = weekStats([mon], '2026-10-19', 5);
    expect(w.completed).toBe(1);
    expect(w.volumeKg).toBe(600);
  });
});

describe('in-app reminders', () => {
  it('shows today’s workout, missed sessions and the recovery day', () => {
    const r = buildReminders({ today: '2026-10-21', templates, sessions: [session('2026-10-19', 'bi_lat_pulldown', lifts(30, [12]), P)], trainingDays: MON_TO_FRI, readyForOverload: [], dismissed: {} });
    expect(r.map((x) => x.kind)).toEqual(['today_workout', 'missed']);
    expect(r[0].title).toBe('Today: Upper Body');
    expect(r[1].title).toContain('Tuesday');
    const sat = buildReminders({ today: '2026-10-24', templates, sessions: [], trainingDays: MON_TO_FRI, readyForOverload: [{ exerciseId: 'x', name: 'Lat pulldown' }], dismissed: {} });
    expect(sat.map((x) => x.kind)).toContain('recovery_day');
    expect(sat.map((x) => x.kind)).toContain('overload');
  });

  it('respects dismissals', () => {
    const r = buildReminders({ today: '2026-10-19', templates, sessions: [], trainingDays: MON_TO_FRI, readyForOverload: [], dismissed: { 'today:2026-10-19': '2026-10-19' } });
    expect(r.find((x) => x.kind === 'today_workout')).toBeUndefined();
  });

  it('weekly review compares volume with the previous week', () => {
    const prev = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [10, 10]), P);
    const cur = session('2026-10-19', 'bi_lat_pulldown', lifts(30, [10, 10, 10]), P);
    const review = weeklyReview([prev, cur], exerciseMap(), templates, MON_TO_FRI, [], '2026-10-19');
    expect(review.volumeChangePct).toBe(50);
    expect(review.completed).toBe(1);
  });
});
