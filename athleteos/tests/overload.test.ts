import { describe, expect, it } from 'vitest';
import { recommend, detectPlateau, exerciseHistory, incrementFor, reducedLoad, type EngineInput } from '@/domain/overload';
import { assessReadiness } from '@/domain/readiness';
import type { Prescription } from '@/domain/types';
import { INC, entry, ex, lifts, session, set } from './helpers';

const pulldown = ex('lat_pulldown');
const p3x10_12: Prescription = { sets: 3, repsMin: 10, repsMax: 12 };

function input(overrides: Partial<EngineInput>): EngineInput {
  return { exercise: pulldown, prescription: p3x10_12, loadMode: 'total', history: [], increments: INC, units: 'kg', readiness: null, ...overrides };
}

describe('double progression — the lat pulldown example', () => {
  it('session 1: 30 kg × 12, 11, 10 → stay at 30 kg', () => {
    const r = recommend(input({ history: [entry('2026-10-05', lifts(30, [12, 11, 10]), p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.suggestedWeightKg).toBe(30);
    expect(r.readyForOverload).toBe(false);
    expect(r.headline).toBe('Stay at 30 kg for lat pulldown.');
    expect(r.reason).toContain('12, 11, 10');
    expect(r.targetReps).toBe(12);
  });

  it('session 2: 30 kg × 12, 12, 12 with good technique and 1–3 RIR → increase to 32.5 kg', () => {
    const r = recommend(
      input({
        history: [entry('2026-10-05', lifts(30, [12, 11, 10]), p3x10_12), entry('2026-10-12', lifts(30, [12, 12, 12], { rir: 2 }), p3x10_12)]
      })
    );
    expect(r.action).toBe('increase_load');
    expect(r.suggestedWeightKg).toBe(32.5);
    expect(r.readyForOverload).toBe(true);
    expect(r.headline).toBe('Increase lat pulldown from 30 kg to 32.5 kg next session.');
    expect(r.reason).toContain('completed all 3 sets at 12 reps with good technique');
    expect(r.basedOn?.date).toBe('2026-10-12');
  });

  it('gives a baseline recommendation when there is no history', () => {
    const r = recommend(input({}));
    expect(r.action).toBe('baseline');
    expect(r.suggestedWeightKg).toBeNull();
    expect(r.reason).toMatch(/No previous/);
  });

  it('does not increase after one good set', () => {
    const r = recommend(input({ history: [entry('2026-10-12', lifts(30, [12, 10, 10]), p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.suggestedWeightKg).toBe(30);
  });

  it('is deterministic — identical input gives identical output', () => {
    const i = input({ history: [entry('2026-10-12', lifts(30, [12, 12, 12]), p3x10_12)] });
    expect(recommend(i)).toEqual(recommend(structuredClone(i)));
  });

  it('uses the most recent session regardless of the order history is supplied in', () => {
    const h = [entry('2026-10-12', lifts(30, [12, 12, 12]), p3x10_12), entry('2026-10-05', lifts(30, [12, 11, 10]), p3x10_12)];
    expect(recommend(input({ history: h })).action).toBe('increase_load');
    expect(recommend(input({ history: [...h].reverse() })).action).toBe('increase_load');
  });
});

describe('failed sets', () => {
  const curls = ex('db_biceps_curl');
  const p: Prescription = { sets: 3, repsMin: 10, repsMax: 12 };

  it('final set slightly below the range → maintain and say why', () => {
    const r = recommend(input({ exercise: curls, prescription: p, loadMode: 'per_dumbbell', history: [entry('2026-10-12', lifts(12, [12, 11, 9]), p, 'per_dumbbell')] }));
    expect(r.action).toBe('maintain');
    expect(r.suggestedWeightKg).toBe(12);
    expect(r.headline).toBe('Maintain 12 kg for dumbbell biceps curls.');
    expect(r.reason).toContain('final set dropped below the target rep range');
    expect(r.flags).toContain('missed_reps');
  });

  it('two sets below the minimum → reduce the load by ~10% (at least one increment)', () => {
    const r = recommend(input({ history: [entry('2026-10-12', lifts(30, [10, 8, 7]), p3x10_12)] }));
    expect(r.action).toBe('decrease_load');
    expect(r.suggestedWeightKg).toBe(27.5);
    expect(r.headline).toBe('Reduce lat pulldown from 30 kg to 27.5 kg.');
    expect(r.reason).toMatch(/2 of 3 sets fell short of 10 reps/);
  });

  it('a large miss on one set (3+ reps short) → reduce', () => {
    const r = recommend(input({ history: [entry('2026-10-12', lifts(30, [11, 10, 6]), p3x10_12)] }));
    expect(r.action).toBe('decrease_load');
  });

  it('missing the minimum two sessions in a row at the same load → reduce', () => {
    const r = recommend(
      input({ history: [entry('2026-10-05', lifts(30, [11, 10, 9]), p3x10_12), entry('2026-10-12', lifts(30, [12, 10, 9]), p3x10_12)] })
    );
    expect(r.action).toBe('decrease_load');
    expect(r.reason).toMatch(/second session in a row/);
  });

  it('missed reps with poor technique → reduce', () => {
    const sets = [set({ w: 30, r: 11 }), set({ w: 30, r: 10 }), set({ w: 30, r: 9, t: 'poor' })];
    const r = recommend(input({ history: [entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).toBe('decrease_load');
    expect(r.flags).toEqual(expect.arrayContaining(['missed_reps', 'technique']));
  });

  it('never suggests a negative load', () => {
    expect(reducedLoad(2, 2.5)).toBe(0);
    expect(reducedLoad(60, 2.5)).toBe(55);
    expect(reducedLoad(100, 2.5)).toBe(90);
    expect(reducedLoad(12, 2)).toBe(10);
  });
});

describe('technique, effort and reps in reserve', () => {
  it('never increases when technique was poor, even with every rep achieved', () => {
    const sets = [set({ w: 30, r: 12 }), set({ w: 30, r: 12 }), set({ w: 30, r: 12, t: 'poor' })];
    const r = recommend(input({ history: [entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.suggestedWeightKg).toBe(30);
    expect(r.flags).toContain('technique');
    expect(r.readyForOverload).toBe(false);
  });

  it('never increases on volume alone when technique deteriorated (more reps, worse form)', () => {
    const sets = lifts(30, [12, 12, 12], { t: 'poor' });
    const r = recommend(input({ history: [entry('2026-10-05', lifts(30, [11, 11, 10]), p3x10_12), entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).not.toBe('increase_load');
  });

  it('reaching the top of the range at 0 RIR (failure) → repeat the load first', () => {
    const sets = [set({ w: 30, r: 12, rir: 2 }), set({ w: 30, r: 12, rir: 1 }), set({ w: 30, r: 12, rir: 0 })];
    const r = recommend(input({ history: [entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.flags).toContain('failure');
  });

  it('missing RIR still allows an increase, with a caveat', () => {
    const r = recommend(input({ history: [entry('2026-10-12', lifts(30, [12, 12, 12], { rir: null }), p3x10_12)] }));
    expect(r.action).toBe('increase_load');
    expect(r.flags).toContain('no_rir');
    expect(r.details.join(' ')).toMatch(/weren’t logged/);
  });

  it('incomplete exercise (2 of 3 sets done) → maintain', () => {
    const sets = [...lifts(30, [12, 12]), set({ w: 30, r: 12, done: false })];
    const r = recommend(input({ history: [entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.flags).toContain('incomplete');
    expect(r.reason).toMatch(/2 of 3 sets/);
  });

  it('assesses only sets at the working load when loads were mixed', () => {
    const sets = [...lifts(30, [12, 12]), set({ w: 27.5, r: 12 })];
    const r = recommend(input({ history: [entry('2026-10-12', sets, p3x10_12)] }));
    expect(r.action).toBe('maintain');
    expect(r.flags).toEqual(expect.arrayContaining(['mixed_loads', 'incomplete']));
  });
});

describe('plateaus', () => {
  it('flags three comparable sessions without progress and suggests checking recovery first', () => {
    const h = [
      entry('2026-09-28', lifts(30, [12, 11, 10]), p3x10_12),
      entry('2026-10-05', lifts(30, [12, 11, 11]), p3x10_12),
      entry('2026-10-12', lifts(30, [12, 11, 10]), p3x10_12)
    ];
    const r = recommend(input({ history: h }));
    expect(r.action).toBe('maintain');
    expect(r.flags).toContain('plateau');
    const text = r.details.join(' ');
    expect(text).toMatch(/3 comparable sessions at 30 kg/);
    expect(text).toMatch(/sleep, rest periods .* weekly training volume/);
    expect(detectPlateau([...h].reverse())?.totals).toEqual([33, 34, 33]);
  });

  it('does not flag a plateau while reps are still improving', () => {
    const h = [
      entry('2026-10-12', lifts(30, [12, 11, 11]), p3x10_12),
      entry('2026-10-05', lifts(30, [12, 11, 10]), p3x10_12),
      entry('2026-09-28', lifts(30, [11, 10, 10]), p3x10_12)
    ];
    expect(recommend(input({ history: h })).flags).not.toContain('plateau');
  });

  it('needs three sessions at the same load', () => {
    const h = [
      entry('2026-10-12', lifts(32.5, [10, 10, 10]), p3x10_12),
      entry('2026-10-05', lifts(30, [12, 12, 12]), p3x10_12),
      entry('2026-09-28', lifts(30, [12, 11, 10]), p3x10_12)
    ];
    expect(detectPlateau(h)).toBeNull();
  });
});

describe('weight increments', () => {
  const top = (w: number, p: Prescription = p3x10_12, mode: 'total' | 'per_dumbbell' = 'total') => [entry('2026-10-12', lifts(w, Array(p.sets).fill(p.repsMax)), p, mode)];

  it('upper-body cable: +2.5 kg by default', () => {
    expect(recommend(input({ history: top(30) })).suggestedWeightKg).toBe(32.5);
  });

  it('lower-body machine: +5 kg by default', () => {
    const r = recommend(input({ exercise: ex('hamstring_curl'), history: top(40) }));
    expect(r.suggestedWeightKg).toBe(45);
  });

  it('dumbbells: the smallest dumbbell jump (2 kg per dumbbell)', () => {
    const r = recommend(input({ exercise: ex('db_bench_press'), loadMode: 'per_dumbbell', history: top(20, p3x10_12, 'per_dumbbell') }));
    expect(r.suggestedWeightKg).toBe(22);
    expect(r.headline).toBe('Increase dumbbell bench press from 20 kg to 22 kg next session.');
  });

  it('respects profile increments (e.g. a gym with 1.25 kg plates)', () => {
    const r = recommend(input({ increments: { ...INC, upperKg: 1.25 }, history: top(30) }));
    expect(r.suggestedWeightKg).toBe(31.25);
  });

  it('a per-exercise increment overrides the profile', () => {
    const r = recommend(input({ exercise: { ...pulldown, incrementKg: 5 }, history: top(30) }));
    expect(r.suggestedWeightKg).toBe(35);
    expect(incrementFor({ ...pulldown, incrementKg: 5 }, 'total', INC)).toBe(5);
  });

  it('formats messages in pounds when the user prefers lb', () => {
    const r = recommend(input({ units: 'lb', history: top(30) }));
    expect(r.headline).toBe('Increase lat pulldown from 66 lb to 71.5 lb next session.');
  });

  it('never compares per-dumbbell history with total-load history', () => {
    const bench = ex('db_bench_press');
    const r = recommend(input({ exercise: bench, loadMode: 'total', history: top(20, p3x10_12, 'per_dumbbell') }));
    expect(r.action).toBe('baseline');
  });
});

describe('recovery check-in (readiness)', () => {
  const ready = [entry('2026-10-12', lifts(30, [12, 12, 12]), p3x10_12)];

  it('missing recovery data → unknown, recommendations use history only', () => {
    const a = assessReadiness(null);
    expect(a.level).toBe('unknown');
    expect(a.allowIncrease).toBe(true);
    expect(recommend(input({ history: ready, readiness: a })).action).toBe('increase_load');
    expect(assessReadiness({ pain: 'none', illness: false }).level).toBe('unknown');
  });

  it('partial check-in data is assessed on what was provided', () => {
    expect(assessReadiness({ sleepHours: 8 }).level).toBe('green');
    expect(assessReadiness({ sleepHours: 5 }).level).toBe('green');
    expect(assessReadiness({ sleepHours: 5, soreness: 4 }).level).toBe('amber');
  });

  it('elevated soreness and fatigue → lighter session; increases are held', () => {
    const a = assessReadiness({ sleepHours: 7, energy: 2, soreness: 4, motivation: 3, pain: 'none', illness: false });
    expect(a.level).toBe('amber');
    expect(a.headline).toBe('Consider a lighter session today');
    const r = recommend(input({ history: ready, readiness: a }));
    expect(r.action).toBe('maintain');
    expect(r.suggestedWeightKg).toBe(30);
    expect(r.readyForOverload).toBe(true);
    expect(r.flags).toContain('readiness');
    expect(r.reason).toMatch(/Consider a lighter session today/);
  });

  it('the athlete can override an amber recommendation', () => {
    const a = assessReadiness({ energy: 2, soreness: 4, overridden: true });
    expect(a.allowIncrease).toBe(true);
    expect(recommend(input({ history: ready, readiness: a })).action).toBe('increase_load');
  });

  it('sharp pain → never recommends pushing through, even when overridden', () => {
    const a = assessReadiness({ energy: 5, soreness: 1, pain: 'sharp', painNotes: 'left hamstring', overridden: true });
    expect(a.level).toBe('red');
    expect(a.allowIncrease).toBe(false);
    expect(a.message).toMatch(/Don’t train through sharp pain/);
    expect(a.message).toMatch(/cannot assess injuries/);
    const r = recommend(input({ history: ready, readiness: a }));
    expect(r.action).toBe('rest');
    expect(r.suggestedWeightKg).toBe(30);
  });

  it('illness → red', () => {
    expect(assessReadiness({ illness: true }).level).toBe('red');
  });

  it('does not change warm-ups', () => {
    const r = recommend(input({ exercise: ex('stationary_bike'), prescription: { sets: 1, durationSec: 300 }, readiness: assessReadiness({ illness: true }) }));
    expect(r.action).toBe('complete');
  });
});

describe('bodyweight, holds and mobility', () => {
  const deadBug = ex('dead_bug');
  const p: Prescription = { sets: 3, repsMin: 10, repsMax: 10, perSide: true };

  it('bodyweight: progresses reps when every set hit the target', () => {
    const r = recommend(input({ exercise: deadBug, prescription: p, loadMode: 'bodyweight', history: [entry('2026-10-13', [set({ r: 10 }), set({ r: 10 }), set({ r: 11 })], p, 'bodyweight')] }));
    expect(r.action).toBe('increase_reps');
    expect(r.targetReps).toBe(12);
    expect(r.suggestedWeightKg).toBeNull();
  });

  it('bodyweight: moves to a harder variation instead of endless reps', () => {
    const r = recommend(input({ exercise: deadBug, prescription: p, loadMode: 'bodyweight', history: [entry('2026-10-13', [set({ r: 16 }), set({ r: 16 }), set({ r: 17 })], p, 'bodyweight')] }));
    expect(r.action).toBe('progress_difficulty');
  });

  it('bodyweight: poor control holds the reps', () => {
    const r = recommend(input({ exercise: deadBug, prescription: p, loadMode: 'bodyweight', history: [entry('2026-10-13', [set({ r: 10 }), set({ r: 10 }), set({ r: 10, t: 'poor' })], p, 'bodyweight')] }));
    expect(r.action).toBe('maintain');
  });

  it('timed holds add 5 seconds', () => {
    const plank = ex('side_plank');
    const hp: Prescription = { sets: 2, durationSec: 30, perSide: true };
    const r = recommend(input({ exercise: plank, prescription: hp, loadMode: 'bodyweight', history: [entry('2026-10-14', [set({ dur: 30 }), set({ dur: 32 })], hp, 'bodyweight')] }));
    expect(r.action).toBe('increase_duration');
    expect(r.targetDurationSec).toBe(35);
  });

  it('mobility tracks range and control, never load', () => {
    const cc = ex('cat_cow');
    const mp: Prescription = { sets: 2, repsMin: 10, repsMax: 10 };
    const h = [entry('2026-10-06', [set({ r: 10, rom: 3, control: 3 })], mp, 'none'), entry('2026-10-13', [set({ r: 10, rom: 4, control: 4 })], mp, 'none')];
    const r = recommend(input({ exercise: cc, prescription: mp, loadMode: 'none', history: h }));
    expect(r.suggestedWeightKg).toBeNull();
    expect(r.reason).toMatch(/range improved from 3 to 4/);
    expect(['hold_quality', 'progress_difficulty']).toContain(r.action);
  });
});

describe('sprints and jumps', () => {
  const s10 = ex('sprint_10m');
  const sp: Prescription = { sets: 4, distanceM: 10 };
  const times = (ts: number[], rest = 120) => ts.map((t) => set({ time: t, dist: 10, rest, rir: null, t: null }));

  it('does not add volume when fatigue compromises times', () => {
    const r = recommend(input({ exercise: s10, prescription: sp, loadMode: 'none', history: [entry('2026-10-16', times([1.8, 1.82, 1.9, 1.95]), sp, 'none')] }));
    expect(r.action).toBe('hold_quality');
    expect(r.flags).toContain('fatigue');
    expect(r.targetSets).toBe(4);
    expect(r.reason).toMatch(/8% slower/);
  });

  it('allows one extra rep after two consistent sessions', () => {
    const h = [entry('2026-10-09', times([1.85, 1.86, 1.87, 1.86]), sp, 'none'), entry('2026-10-16', times([1.82, 1.83, 1.84, 1.83]), sp, 'none')];
    const r = recommend(input({ exercise: s10, prescription: sp, loadMode: 'none', history: h }));
    expect(r.action).toBe('add_set');
    expect(r.targetSets).toBe(5);
  });

  it('elevated fatigue in the check-in blocks the extra rep', () => {
    const h = [entry('2026-10-09', times([1.85, 1.86, 1.87, 1.86]), sp, 'none'), entry('2026-10-16', times([1.82, 1.83, 1.84, 1.83]), sp, 'none')];
    const r = recommend(input({ exercise: s10, prescription: sp, loadMode: 'none', history: h, readiness: assessReadiness({ energy: 2, soreness: 4 }) }));
    expect(r.action).toBe('maintain');
    expect(r.targetSets).toBe(4);
  });

  it('short rest is called out', () => {
    const r = recommend(input({ exercise: s10, prescription: sp, loadMode: 'none', history: [entry('2026-10-16', times([1.8, 1.81, 1.82, 1.81], 30), sp, 'none')] }));
    expect(r.details.join(' ')).toMatch(/less than/);
  });

  it('jumps: poor landings take priority over distance', () => {
    const bj = ex('broad_jump');
    const jp: Prescription = { sets: 3, repsMin: 3, repsMax: 3 };
    const r = recommend(input({ exercise: bj, prescription: jp, loadMode: 'none', history: [entry('2026-10-15', [set({ dist: 2.4 }), set({ dist: 2.45, t: 'poor' }), set({ dist: 2.3 })], jp, 'none')] }));
    expect(r.action).toBe('hold_quality');
    expect(r.flags).toContain('technique');
  });

  it('jumps: distance drop-off is treated as fatigue', () => {
    const bj = ex('broad_jump');
    const jp: Prescription = { sets: 3, repsMin: 3, repsMax: 3 };
    const r = recommend(input({ exercise: bj, prescription: jp, loadMode: 'none', history: [entry('2026-10-15', [set({ dist: 2.5 }), set({ dist: 2.4 }), set({ dist: 2.2 })], jp, 'none')] }));
    expect(r.flags).toContain('fatigue');
  });
});

describe('history extraction and incomplete workouts', () => {
  const id = pulldown.id;

  it('ignores in-progress, deleted and the current session; ignores skipped exercises', () => {
    const done = session('2026-10-12', id, lifts(30, [12, 12, 12]), p3x10_12);
    const live = session('2026-10-19', id, lifts(32.5, [12, 12, 12]), p3x10_12, { status: 'in_progress', endedAt: null, id: 'live' });
    const deleted = session('2026-10-15', id, lifts(40, [12, 12, 12]), p3x10_12, { deletedAt: '2026-10-16T00:00:00Z', id: 'del' });
    const skipped = session('2026-10-16', id, lifts(50, [12, 12, 12]), p3x10_12, { id: 'skip' });
    skipped.exercises[0].skipped = true;
    const h = exerciseHistory([done, live, deleted, skipped], id);
    expect(h.map((x) => x.sessionId)).toEqual([done.id]);
    expect(exerciseHistory([done], id, { excludeSessionId: done.id })).toEqual([]);
  });

  it('a workout finished early still counts what was completed, and is treated as incomplete', () => {
    const partial = session('2026-10-12', id, [...lifts(30, [12]), set({ w: 30, r: 12, done: false }), set({ w: 30, r: 12, done: false })], p3x10_12);
    const h = exerciseHistory([partial], id);
    expect(h).toHaveLength(1);
    const r = recommend(input({ history: h }));
    expect(r.action).toBe('maintain');
    expect(r.flags).toContain('incomplete');
  });

  it('an exercise with no completed sets is not history at all', () => {
    const none = session('2026-10-12', id, lifts(30, [12, 12, 12], { done: false }), p3x10_12);
    expect(exerciseHistory([none], id)).toEqual([]);
  });
});
