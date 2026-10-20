import type { Exercise, ID, ISODate, IncrementSettings, LoadMode, Prescription, SetLog, Units, WorkoutSession } from './types';
import type { ReadinessAssessment } from './readiness';
import { formatWeight, formatNumber } from '@/lib/units';

// ─────────────────────────────────────────────────────────────────────────────
// Progressive overload engine
//
// Deterministic and side-effect free: the same history always produces the same recommendation.
// It compares today's target with the most recent *comparable* performance of the same exercise
// (same exercise id and the same load mode, so "per dumbbell" is never compared with "total" and
// variations are never mixed), and explains every recommendation in plain language.
//
// Recommendations are guidance, not guarantees.
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationAction =
  | 'baseline' // no comparable history yet
  | 'increase_load'
  | 'maintain'
  | 'decrease_load'
  | 'increase_reps'
  | 'increase_duration'
  | 'add_set'
  | 'progress_difficulty'
  | 'hold_quality' // speed/power/mobility: keep the same, focus on quality
  | 'complete' // warm-ups and cool-downs
  | 'rest'; // readiness says don't push today

export type RecommendationFlag = 'plateau' | 'technique' | 'missed_reps' | 'failure' | 'incomplete' | 'fatigue' | 'readiness' | 'no_rir' | 'mixed_loads';

export interface Recommendation {
  action: RecommendationAction;
  /** One-line instruction, e.g. "Increase lat pulldown from 30 kg to 32.5 kg next session." */
  headline: string;
  /** Why the recommendation was generated. */
  reason: string;
  /** Extra caveats and context. */
  details: string[];
  suggestedWeightKg: number | null;
  targetReps: number | null;
  targetDurationSec: number | null;
  targetSets: number | null;
  /** Performance alone says it's time to progress (independent of today's readiness). */
  readyForOverload: boolean;
  flags: RecommendationFlag[];
  basedOn: { sessionId: ID; date: ISODate } | null;
}

/** One past performance of an exercise. */
export interface ExerciseHistoryEntry {
  sessionId: ID;
  date: ISODate;
  /** Tie-breaker for sessions on the same day. */
  timestamp: string;
  loadMode: LoadMode;
  prescription: Prescription;
  sets: SetLog[];
}

export interface EngineInput {
  exercise: Exercise;
  /** Today's target. */
  prescription: Prescription;
  /** Today's load mode. Only history logged the same way is compared. */
  loadMode: LoadMode;
  history: ExerciseHistoryEntry[];
  increments: IncrementSettings;
  units: Units;
  readiness?: ReadinessAssessment | null;
}

// ── Tunable constants (documented, deterministic) ────────────────────────────
export const PLATEAU_SESSIONS = 3;
/** A miss this many reps below the minimum (or more) counts as a significant miss. */
export const SIGNIFICANT_MISS_REPS = 3;
/** Load reduction after a significant miss: 10%, never less than one increment. */
export const DELOAD_FRACTION = 0.1;
/** Sprint/agility: a slowest rep more than this much slower than the best indicates fatigue. */
export const SPRINT_FATIGUE_DROPOFF = 0.05;
export const SPRINT_CONSISTENT_DROPOFF = 0.03;
/** Jumps: distance drop-off that indicates fatigue. */
export const JUMP_FATIGUE_DROPOFF = 0.07;
export const HOLD_STEP_SEC = 5;
export const HOLD_CAP_SEC = 60;
export const BODYWEIGHT_REP_HEADROOM = 6;
export const MAX_EXTRA_SPRINT_SETS = 2;

// ── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function incrementFor(exercise: Exercise, loadMode: LoadMode, inc: IncrementSettings): number {
  if (isNum(exercise.incrementKg) && exercise.incrementKg > 0) return exercise.incrementKg;
  const dumbbellish = loadMode === 'per_dumbbell' || exercise.equipment[0] === 'dumbbell' || exercise.equipment[0] === 'kettlebell';
  if (dumbbellish) return inc.dumbbellKg;
  return exercise.bodyRegion === 'lower' ? inc.lowerKg : inc.upperKg;
}

/** New load after a significant miss: about −10%, rounded to the nearest increment, at least one increment. */
export function reducedLoad(weightKg: number, incrementKg: number): number {
  const cut = Math.max(incrementKg, Math.round((weightKg * DELOAD_FRACTION) / incrementKg) * incrementKg);
  return Math.max(0, round2(weightKg - cut));
}

export function repRange(p: Prescription): { min: number; max: number } {
  const min = isNum(p.repsMin) ? p.repsMin : isNum(p.repsMax) ? p.repsMax : 10;
  const max = isNum(p.repsMax) ? Math.max(p.repsMax, min) : min;
  return { min, max };
}

const completedSets = (sets: SetLog[]) => sets.filter((s) => s.completed);

/** Sets that count as working sets for a loaded exercise (completed, with reps). */
function workingSets(entry: ExerciseHistoryEntry): { weight: number; sets: SetLog[]; mixed: boolean } | null {
  const done = completedSets(entry.sets).filter((s) => isNum(s.reps) && s.reps > 0);
  if (done.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of done) {
    const w = round2(s.weightKg ?? 0);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  // Working weight = the load used for the most sets (ties → the heavier load).
  let weight = 0;
  let best = -1;
  for (const [w, n] of counts) {
    if (n > best || (n === best && w > weight)) {
      weight = w;
      best = n;
    }
  }
  return { weight, sets: done.filter((s) => round2(s.weightKg ?? 0) === weight), mixed: counts.size > 1 };
}

const listReps = (sets: SetLog[]) => sets.map((s) => s.reps ?? 0).join(', ');
const lc = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

function ordinalSet(index: number, total: number): string {
  if (index === total - 1) return 'final set';
  return ['first set', 'second set', 'third set', 'fourth set', 'fifth set'][index] ?? `set ${index + 1}`;
}

function base(partial: Partial<Recommendation> & Pick<Recommendation, 'action' | 'headline' | 'reason'>): Recommendation {
  return {
    details: [],
    suggestedWeightKg: null,
    targetReps: null,
    targetDurationSec: null,
    targetSets: null,
    readyForOverload: false,
    flags: [],
    basedOn: null,
    ...partial
  };
}

/** Only history logged the same way, newest first. */
export function comparableHistory(history: ExerciseHistoryEntry[], loadMode: LoadMode): ExerciseHistoryEntry[] {
  return history
    .filter((h) => h.loadMode === loadMode && completedSets(h.sets).length > 0)
    .slice()
    .sort((a, b) => (a.date === b.date ? b.timestamp.localeCompare(a.timestamp) : b.date.localeCompare(a.date)));
}

// ── Public entry point ──────────────────────────────────────────────────────

export function recommend(input: EngineInput): Recommendation {
  const rec = recommendIgnoringReadiness(input);
  return applyReadiness(rec, input);
}

export function recommendIgnoringReadiness(input: EngineInput): Recommendation {
  switch (input.exercise.progressionType) {
    case 'double_progression':
      return doubleProgression(input);
    case 'bodyweight_reps':
      return bodyweightReps(input);
    case 'timed_hold':
      return timedHold(input);
    case 'mobility':
      return mobility(input);
    case 'sprint':
    case 'agility':
      return speed(input);
    case 'jump':
      return jump(input);
    case 'conditioning':
    default:
      return base({
        action: 'complete',
        headline: `Complete ${lc(input.exercise.name)} at an easy effort.`,
        reason: 'Warm-ups, cool-downs and easy cardio are there to prepare and recover — they don’t need progressing.'
      });
  }
}

// ── Double progression (loaded strength) ───────────────────────────────────

function doubleProgression(input: EngineInput): Recommendation {
  const { exercise, prescription, units } = input;
  const name = exercise.name;
  const { min, max } = repRange(prescription);
  const sets = Math.max(1, prescription.sets);
  const inc = incrementFor(exercise, input.loadMode, input.increments);
  const w = (kg: number) => formatWeight(kg, units);
  const rangeText = min === max ? `${max}` : `${min}–${max}`;
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  const lastWork = last ? workingSets(last) : null;

  if (!last || !lastWork) {
    return base({
      action: 'baseline',
      headline: `Find your starting weight for ${lc(name)}.`,
      reason: `No previous ${lc(name)} sessions logged this way yet. Choose a load you can lift for ${rangeText} reps with good technique and about 2–3 reps in reserve.`,
      targetReps: max,
      targetSets: sets
    });
  }

  const weight = lastWork.weight;
  const work = lastWork.sets;
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const details: string[] = [];
  const flags: Recommendation['flags'] = [];
  if (lastWork.mixed) {
    flags.push('mixed_loads');
    details.push(`Last session used more than one load; only the ${work.length} set(s) at ${w(weight)} were assessed.`);
  }
  const plateau = detectPlateau(history);
  const addPlateau = (r: Recommendation): Recommendation => {
    if (!plateau) return r;
    return {
      ...r,
      flags: [...r.flags, 'plateau'],
      details: [
        ...r.details,
        `Plateau: ${PLATEAU_SESSIONS} comparable sessions at ${w(plateau.weight)} without progress (total reps ${plateau.totals.join(' → ')}). ` +
          `Before changing the programme, check your sleep, rest periods (about ${Math.round((exercise.restSeconds || 90) / 15) * 15} s between sets) and weekly training volume.`
      ]
    };
  };

  // 1. Not all prescribed sets completed at the working load → can't confirm progress.
  if (work.length < sets) {
    return addPlateau(
      base({
        action: 'maintain',
        headline: `Maintain ${w(weight)} for ${lc(name)}.`,
        reason: `You completed ${work.length} of ${sets} sets at ${w(weight)} last time. Complete every prescribed set before increasing.`,
        details,
        flags: [...flags, 'incomplete'],
        suggestedWeightKg: weight,
        targetReps: max,
        targetSets: sets,
        basedOn
      })
    );
  }

  const evaluated = work.slice(0, sets);
  const poor = evaluated.filter((s) => s.technique === 'poor').length;
  const missedIdx = evaluated.map((s, i) => ((s.reps ?? 0) < min ? i : -1)).filter((i) => i >= 0);
  const allTop = evaluated.every((s) => (s.reps ?? 0) >= max);
  const rirs = evaluated.map((s) => s.rir).filter(isNum);
  const hitFailure = rirs.some((r) => r <= 0);

  // 2. Missed the minimum rep target.
  if (missedIdx.length > 0) {
    const worstShortfall = Math.max(...missedIdx.map((i) => min - (evaluated[i].reps ?? 0)));
    const prev = history[1] ? workingSets(history[1]) : null;
    const repeatedMiss = !!prev && prev.weight === weight && prev.sets.some((s) => (s.reps ?? 0) < min);
    const significant = missedIdx.length >= 2 || worstShortfall >= SIGNIFICANT_MISS_REPS || missedIdx[0] === 0 || repeatedMiss || poor > 0;
    if (significant && weight > 0) {
      const lower = reducedLoad(weight, inc);
      const why: string[] = [];
      if (missedIdx.length >= 2) why.push(`${missedIdx.length} of ${sets} sets fell short of ${min} reps (${listReps(evaluated)})`);
      else why.push(`your ${ordinalSet(missedIdx[0], evaluated.length)} fell ${worstShortfall} rep${worstShortfall === 1 ? '' : 's'} short of ${min} (${listReps(evaluated)})`);
      if (repeatedMiss) why.push('this is the second session in a row below the target at this load');
      if (poor > 0) why.push(`technique was rated poor on ${plural(poor, 'set')}`);
      return addPlateau(
        base({
          action: 'decrease_load',
          headline: `Reduce ${lc(name)} from ${w(weight)} to ${w(lower)}.`,
          reason: `${capitalise(why.join('; '))}. A slightly lighter load lets you complete ${rangeText} reps with good form, then build back up.`,
          details: [...details, 'If you were short on sleep or rest that day, repeating the same load once is also reasonable.'],
          flags: [...flags, 'missed_reps', ...(poor > 0 ? (['technique'] as const) : [])],
          suggestedWeightKg: lower,
          targetReps: max,
          targetSets: sets,
          basedOn
        })
      );
    }
    const i = missedIdx[0];
    return addPlateau(
      base({
        action: 'maintain',
        headline: `Maintain ${w(weight)} for ${lc(name)}.`,
        reason: `Your ${ordinalSet(i, evaluated.length)} dropped below the target rep range (${listReps(evaluated)} vs ${rangeText}). Repeat this load and aim for at least ${min} reps on every set.`,
        details,
        flags: [...flags, 'missed_reps'],
        suggestedWeightKg: weight,
        targetReps: max,
        targetSets: sets,
        basedOn
      })
    );
  }

  // 3. Technique deteriorated → never increase, whatever the reps or volume.
  if (poor > 0) {
    return addPlateau(
      base({
        action: 'maintain',
        headline: `Maintain ${w(weight)} for ${lc(name)}.`,
        reason: `Technique was rated poor on ${plural(poor, 'set')} last session. Own the movement at ${w(weight)} before adding load — reps alone aren’t enough to progress.`,
        details,
        flags: [...flags, 'technique'],
        suggestedWeightKg: weight,
        targetReps: max,
        targetSets: sets,
        basedOn
      })
    );
  }

  // 4. Top of the range on every set.
  if (allTop) {
    if (hitFailure) {
      return addPlateau(
        base({
          action: 'maintain',
          headline: `Repeat ${w(weight)} for ${lc(name)} once more.`,
          reason: `You reached ${max} reps on every set, but at least one set went to failure (0 reps in reserve). Repeat ${w(weight)} and finish each set with 1–3 reps in reserve before increasing.`,
          details,
          flags: [...flags, 'failure'],
          suggestedWeightKg: weight,
          targetReps: max,
          targetSets: sets,
          basedOn
        })
      );
    }
    const next = round2(weight + inc);
    const extra: string[] = [...details];
    const fl: Recommendation['flags'] = [...flags];
    if (rirs.length < evaluated.length) {
      fl.push('no_rir');
      extra.push('Reps in reserve weren’t logged for every set — increase only if the final reps were controlled.');
    }
    if (evaluated.some((s) => s.technique == null)) extra.push('Technique wasn’t rated on every set; keep form strict with the heavier load.');
    if (rirs.length > 0 && Math.min(...rirs) > 3) extra.push('You had more than 3 reps in reserve on every set, so this jump should feel manageable.');
    if (weight === 0) {
      return base({
        action: 'increase_load',
        headline: `Add ${w(inc)} to ${lc(name)}.`,
        reason: `You completed all ${sets} sets at ${max} reps with bodyweight and good technique. Hold a light weight next session.`,
        details: extra,
        flags: fl,
        suggestedWeightKg: next,
        targetReps: min,
        targetSets: sets,
        readyForOverload: true,
        basedOn
      });
    }
    const techniqueText = evaluated.every((s) => s.technique === 'good') ? ' with good technique' : '';
    return base({
      action: 'increase_load',
      headline: `Increase ${lc(name)} from ${w(weight)} to ${w(next)} next session.`,
      reason: `You completed all ${sets} sets at ${max} reps${techniqueText}${rirs.length === evaluated.length ? ` and ${rirDescription(rirs)}` : ''}. Expect fewer reps at the new load — build back up to ${max}.`,
      details: extra,
      flags: fl,
      suggestedWeightKg: next,
      targetReps: min,
      targetSets: sets,
      readyForOverload: true,
      basedOn
    });
  }

  // 5. Within the range but not yet at the top on every set → add reps first.
  const below = evaluated.filter((s) => (s.reps ?? 0) < max).length;
  return addPlateau(
    base({
      action: 'maintain',
      headline: `Stay at ${w(weight)} for ${lc(name)}.`,
      reason: `You got ${listReps(evaluated)} reps. Aim to reach ${max} on ${below === evaluated.length ? 'every set' : `the ${plural(below, 'set')} below ${max}`} before increasing the weight.`,
      details,
      flags,
      suggestedWeightKg: weight,
      targetReps: max,
      targetSets: sets,
      basedOn
    })
  );
}

function rirDescription(rirs: number[]): string {
  const lo = Math.min(...rirs);
  const hi = Math.max(...rirs);
  return lo === hi ? `${lo} rep${lo === 1 ? '' : 's'} in reserve` : `${lo}–${hi} reps in reserve`;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A plateau: the last PLATEAU_SESSIONS comparable sessions all used the same working load, none reached the
 * top of the range on every set, and the most recent total reps are no better than the oldest of the window.
 */
export function detectPlateau(history: ExerciseHistoryEntry[]): { weight: number; totals: number[] } | null {
  if (history.length < PLATEAU_SESSIONS) return null;
  const window = history.slice(0, PLATEAU_SESSIONS);
  const works = window.map(workingSets);
  if (works.some((w) => !w)) return null;
  const weight = works[0]!.weight;
  if (weight <= 0 || works.some((w) => w!.weight !== weight)) return null;
  const totals = works.map((w) => w!.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)).reverse(); // oldest → newest
  const hitTop = window.some((h, i) => {
    const { max } = repRange(h.prescription);
    const ws = works[i]!.sets;
    return ws.length >= h.prescription.sets && ws.every((s) => (s.reps ?? 0) >= max);
  });
  if (hitTop) return null;
  if (totals[totals.length - 1] > totals[0]) return null;
  return { weight, totals };
}

// ── Bodyweight reps ─────────────────────────────────────────────────────────

function bodyweightReps(input: EngineInput): Recommendation {
  const { exercise, prescription } = input;
  const { max } = repRange(prescription);
  const target = max;
  const sets = Math.max(1, prescription.sets);
  const side = prescription.perSide ? ' per side' : '';
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  const done = last ? completedSets(last.sets).filter((s) => isNum(s.reps) && s.reps > 0) : [];
  if (!last || done.length === 0) {
    return base({
      action: 'baseline',
      headline: `Complete ${sets} × ${target}${side} ${lc(exercise.name)} with control.`,
      reason: `No previous ${lc(exercise.name)} sessions logged yet. Focus on slow, controlled reps.`,
      targetReps: target,
      targetSets: sets
    });
  }
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const minReps = Math.min(...done.map((s) => s.reps ?? 0));
  const poor = done.filter((s) => s.technique === 'poor').length;
  if (done.length < sets) {
    return base({
      action: 'maintain',
      headline: `Repeat ${sets} × ${target}${side}.`,
      reason: `You completed ${done.length} of ${sets} sets last time. Complete every set before adding reps.`,
      flags: ['incomplete'],
      targetReps: target,
      targetSets: sets,
      basedOn
    });
  }
  if (poor > 0) {
    return base({
      action: 'maintain',
      headline: `Keep ${target} reps${side} and focus on control.`,
      reason: `Control was rated poor on ${plural(poor, 'set')}. Slow the reps down and own the position before adding more.`,
      flags: ['technique'],
      targetReps: target,
      targetSets: sets,
      basedOn
    });
  }
  if (minReps < target) {
    return base({
      action: 'maintain',
      headline: `Aim for ${target} reps${side} on every set.`,
      reason: `Your lowest set was ${minReps} reps (${listReps(done)}). Reach ${target} on every set with good control before progressing.`,
      flags: ['missed_reps'],
      targetReps: target,
      targetSets: sets,
      basedOn
    });
  }
  const cap = target + BODYWEIGHT_REP_HEADROOM;
  if (minReps >= cap) {
    return base({
      action: 'progress_difficulty',
      headline: `Progress ${lc(exercise.name)} to a harder version.`,
      reason: `You managed at least ${minReps} reps${side} on every set. Rather than adding more reps, make it harder — slower tempo, a pause at the hardest point, or a more challenging variation — and return to ${target} reps.`,
      targetReps: target,
      targetSets: sets,
      readyForOverload: true,
      basedOn
    });
  }
  const next = Math.min(cap, minReps + 2);
  return base({
    action: 'increase_reps',
    headline: `Add reps: aim for ${next}${side} per set.`,
    reason: `You completed all ${sets} sets with at least ${minReps} reps${side} and good control.`,
    targetReps: next,
    targetSets: sets,
    readyForOverload: true,
    basedOn
  });
}

// ── Timed holds ─────────────────────────────────────────────────────────────

function timedHold(input: EngineInput): Recommendation {
  const { exercise, prescription } = input;
  const target = isNum(prescription.durationSec) ? prescription.durationSec : 30;
  const sets = Math.max(1, prescription.sets);
  const side = prescription.perSide ? ' each side' : '';
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  const done = last ? completedSets(last.sets).filter((s) => isNum(s.durationSec) && s.durationSec > 0) : [];
  if (!last || done.length === 0) {
    return base({
      action: 'baseline',
      headline: `Hold ${target} s${side} with a solid position.`,
      reason: `No previous ${lc(exercise.name)} sessions logged yet.`,
      targetDurationSec: target,
      targetSets: sets
    });
  }
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const shortest = Math.min(...done.map((s) => s.durationSec ?? 0));
  const poor = done.filter((s) => s.technique === 'poor').length;
  if (done.length < sets || poor > 0 || shortest < target) {
    const why =
      done.length < sets
        ? `You completed ${done.length} of ${sets} sets last time.`
        : poor > 0
          ? `Your position was rated poor on ${plural(poor, 'set')} — quality first.`
          : `Your shortest hold was ${shortest} s against a ${target} s target.`;
    return base({
      action: 'maintain',
      headline: `Keep ${target} s holds${side}.`,
      reason: why,
      flags: done.length < sets ? ['incomplete'] : poor > 0 ? ['technique'] : ['missed_reps'],
      targetDurationSec: target,
      targetSets: sets,
      basedOn
    });
  }
  if (shortest >= HOLD_CAP_SEC) {
    return base({
      action: 'progress_difficulty',
      headline: `Make ${lc(exercise.name)} harder instead of longer.`,
      reason: `You held at least ${shortest} s on every set. Beyond about ${HOLD_CAP_SEC} s, a harder variation (e.g. lifting the top leg, or adding a reach) builds more strength than longer holds.`,
      targetDurationSec: target,
      targetSets: sets,
      readyForOverload: true,
      basedOn
    });
  }
  const next = Math.min(HOLD_CAP_SEC, Math.max(target, shortest) + HOLD_STEP_SEC);
  return base({
    action: 'increase_duration',
    headline: `Increase holds to ${next} s${side}.`,
    reason: `You held at least ${shortest} s on every set with a good position.`,
    targetDurationSec: next,
    targetSets: sets,
    readyForOverload: true,
    basedOn
  });
}

// ── Mobility ────────────────────────────────────────────────────────────────

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function mobilityScores(entry: ExerciseHistoryEntry) {
  const done = completedSets(entry.sets);
  return { rom: avg(done.map((s) => s.rom).filter(isNum)), control: avg(done.map((s) => s.control).filter(isNum)) };
}

function mobility(input: EngineInput): Recommendation {
  const { exercise } = input;
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  if (!last) {
    return base({
      action: 'baseline',
      headline: 'Move through a comfortable range.',
      reason: `Mobility is about range and control, not load. After each set, rate how comfortable the range felt and how well you controlled it (1–5).`
    });
  }
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const now = mobilityScores(last);
  const prev = history[1] ? mobilityScores(history[1]) : null;
  if (Number.isNaN(now.rom) && Number.isNaN(now.control)) {
    return base({
      action: 'hold_quality',
      headline: 'Keep moving within a comfortable range.',
      reason: 'Range and control weren’t rated last time. Rating them (1–5) lets AthleteOS show whether your mobility is improving.',
      basedOn
    });
  }
  const parts: string[] = [];
  if (!Number.isNaN(now.rom)) {
    const r = formatNumber(now.rom, 1);
    if (prev && !Number.isNaN(prev.rom) && now.rom !== prev.rom) parts.push(`Comfortable range ${now.rom > prev.rom ? 'improved' : 'dipped'} from ${formatNumber(prev.rom, 1)} to ${r}/5.`);
    else parts.push(`Comfortable range ${r}/5.`);
  }
  if (!Number.isNaN(now.control)) {
    const c = formatNumber(now.control, 1);
    if (prev && !Number.isNaN(prev.control) && now.control !== prev.control) parts.push(`Control ${now.control > prev.control ? 'improved' : 'dipped'} from ${formatNumber(prev.control, 1)} to ${c}/5.`);
    else parts.push(`Control ${c}/5.`);
  }
  const strong = now.rom >= 4 && now.control >= 4;
  return base({
    action: strong ? 'progress_difficulty' : 'hold_quality',
    headline: strong ? `Explore a little more range on ${lc(exercise.name)}.` : `Keep ${lc(exercise.name)} slow and comfortable.`,
    reason:
      parts.join(' ') +
      (strong
        ? ' When it feels easy, add a 2–3 second pause at end range or move slightly further — only while it stays comfortable.'
        : ' Stay in a pain-free range and move with your breathing; range improves with consistency, not force.'),
    basedOn
  });
}

// ── Sprints and agility ─────────────────────────────────────────────────────

function speed(input: EngineInput): Recommendation {
  const { exercise, prescription } = input;
  const sets = Math.max(1, prescription.sets);
  const rest = exercise.restSeconds || 120;
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  if (!last) {
    return base({
      action: 'baseline',
      headline: `${sets} high-quality reps with full rest.`,
      reason: `No previous ${lc(exercise.name)} sessions yet. Every rep should be close to maximal effort with about ${Math.round(rest / 30) / 2} minutes of rest. Time reps if you can (a phone video works).`,
      targetSets: sets
    });
  }
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const done = completedSets(last.sets);
  const times = done.map((s) => s.timeSec).filter((t): t is number => isNum(t) && t > 0);
  const details: string[] = [];
  const shortRests = done.filter((s) => isNum(s.restSec) && s.restSec < rest * 0.75).length;
  if (shortRests > 0) details.push(`${plural(shortRests, 'rep')} had less than ${Math.round(rest * 0.75)} s rest — full rest keeps every rep fast.`);

  if (times.length < 2) {
    return base({
      action: 'hold_quality',
      headline: `Keep ${sets} reps with full rest.`,
      reason:
        times.length === 1
          ? `Only one time was recorded (${formatNumber(times[0], 2)} s). Time every rep to track consistency.`
          : 'Times weren’t recorded last session. Timing reps lets AthleteOS check consistency and spot fatigue.',
      details,
      targetSets: sets,
      basedOn
    });
  }
  const best = Math.min(...times);
  const worst = Math.max(...times);
  const drop = (worst - best) / best;
  const pct = Math.round(drop * 100);
  const bestText = `${formatNumber(best, 2)} s`;
  if (drop > SPRINT_FATIGUE_DROPOFF) {
    return base({
      action: 'hold_quality',
      headline: `Don’t add reps — keep ${sets} and rest fully.`,
      reason: `Your slowest rep was ${pct}% slower than your best (${bestText}), which suggests fatigue was compromising quality. Stop the set when times drop off rather than pushing through.`,
      details,
      flags: ['fatigue'],
      targetSets: sets,
      basedOn
    });
  }
  const prevTimes = history[1] ? completedSets(history[1].sets).map((s) => s.timeSec).filter((t): t is number => isNum(t) && t > 0) : [];
  const prevConsistent = prevTimes.length >= 2 && (Math.max(...prevTimes) - Math.min(...prevTimes)) / Math.min(...prevTimes) <= SPRINT_CONSISTENT_DROPOFF;
  if (drop <= SPRINT_CONSISTENT_DROPOFF && done.length >= sets && prevConsistent && done.length < sets + MAX_EXTRA_SPRINT_SETS && shortRests === 0) {
    return base({
      action: 'add_set',
      headline: `Ready to add one rep (${sets + 1} total) if you feel fresh.`,
      reason: `Your times were consistent (within ${Math.max(1, pct)}%) for two sessions in a row, best ${bestText}. One extra rep is enough — stop early if times slow down.`,
      details,
      targetSets: sets + 1,
      readyForOverload: true,
      basedOn
    });
  }
  return base({
    action: 'hold_quality',
    headline: `Keep ${sets} reps; aim to match ${bestText}.`,
    reason: `Times were ${pct <= 3 ? 'consistent' : 'reasonably consistent'} (slowest within ${Math.max(1, pct)}% of your best). Keep full rest and focus on a powerful start.`,
    details,
    targetSets: sets,
    basedOn
  });
}

// ── Jumps ───────────────────────────────────────────────────────────────────

function jump(input: EngineInput): Recommendation {
  const { exercise, prescription } = input;
  const sets = Math.max(1, prescription.sets);
  const reps = repRange(prescription).max;
  const history = comparableHistory(input.history, input.loadMode);
  const last = history[0];
  if (!last) {
    return base({
      action: 'baseline',
      headline: `${sets} × ${reps} maximal jumps, full reset between reps.`,
      reason: `No previous ${lc(exercise.name)} sessions yet. Log your best distance per set and rate the landing. Explosive quality matters more than exhaustion.`,
      targetSets: sets,
      targetReps: reps
    });
  }
  const basedOn = { sessionId: last.sessionId, date: last.date };
  const done = completedSets(last.sets);
  const poor = done.filter((s) => s.technique === 'poor').length;
  const dists = done.map((s) => s.distanceM).filter((d): d is number => isNum(d) && d > 0);
  if (poor > 0) {
    return base({
      action: 'hold_quality',
      headline: `Keep ${sets} × ${reps} and land softly.`,
      reason: `Landing quality was poor on ${plural(poor, 'set')}. Stick each landing (knees over toes, soft hips) and end the set if landings get heavy.`,
      flags: ['technique'],
      targetSets: sets,
      targetReps: reps,
      basedOn
    });
  }
  if (dists.length < 2) {
    return base({
      action: 'hold_quality',
      headline: `Keep ${sets} × ${reps} with full recovery.`,
      reason: dists.length === 1 ? `Best distance ${formatNumber(dists[0], 2)} m. Log every set to track consistency.` : 'Distances weren’t recorded last time — log your best jump in each set.',
      targetSets: sets,
      targetReps: reps,
      basedOn
    });
  }
  const best = Math.max(...dists);
  const worst = Math.min(...dists);
  const drop = (best - worst) / best;
  if (drop > JUMP_FATIGUE_DROPOFF) {
    return base({
      action: 'hold_quality',
      headline: 'Rest longer between sets; don’t add jumps.',
      reason: `Distance dropped ${Math.round(drop * 100)}% from your best (${formatNumber(best, 2)} m). That’s fatigue — rest 90–120 s and keep reps low so every jump is explosive.`,
      flags: ['fatigue'],
      targetSets: sets,
      targetReps: reps,
      basedOn
    });
  }
  return base({
    action: 'hold_quality',
    headline: `Good quality — aim to match or beat ${formatNumber(best, 2)} m.`,
    reason: `Distances were consistent with good landings. Keep ${sets} × ${reps}: power improves through quality reps, not more volume.`,
    targetSets: sets,
    targetReps: reps,
    basedOn
  });
}

// ── Readiness adjustments ───────────────────────────────────────────────────

const PROGRESSIVE: RecommendationAction[] = ['increase_load', 'increase_reps', 'increase_duration', 'add_set', 'progress_difficulty'];

export function applyReadiness(rec: Recommendation, input: EngineInput): Recommendation {
  const r = input.readiness;
  if (!r || r.level === 'unknown' || r.level === 'green') return rec;
  if (rec.action === 'complete') return rec;
  const name = lc(input.exercise.name);
  const history = comparableHistory(input.history, input.loadMode);
  const lastWork = history[0] ? workingSets(history[0]) : null;
  const currentWeight = rec.action === 'increase_load' || rec.action === 'decrease_load' ? (lastWork?.weight ?? rec.suggestedWeightKg) : rec.suggestedWeightKg;

  if (r.level === 'red') {
    return {
      ...rec,
      action: 'rest',
      headline: `Skip ${name} or keep it very light today.`,
      reason: `${r.reasons.join(' ')} Don’t train through sharp pain or illness.`.trim(),
      details: rec.readyForOverload ? ['Performance-wise you’re ready to progress — save it for a day you feel well.'] : [],
      suggestedWeightKg: currentWeight ?? null,
      targetSets: rec.targetSets,
      flags: [...rec.flags, 'readiness']
    };
  }

  // Amber: no increases unless the athlete chose to override.
  if (r.allowIncrease || !PROGRESSIVE.includes(rec.action)) {
    return r.level === 'amber' && !r.allowIncrease ? { ...rec, details: [...rec.details, 'Today’s check-in suggests a lighter session.'] } : rec;
  }
  const isLoad = rec.action === 'increase_load';
  const w = currentWeight != null ? formatWeight(currentWeight, input.units) : null;
  return {
    ...rec,
    action: 'maintain',
    headline: isLoad && w ? `Keep ${name} at ${w} today.` : `Repeat last session’s target for ${name} today.`,
    reason: `Consider a lighter session today. ${r.reasons.join(' ')}`.trim(),
    details: ['Performance-wise you’re ready to progress — make the increase next session if you feel better.', ...rec.details],
    suggestedWeightKg: isLoad ? (currentWeight ?? null) : rec.suggestedWeightKg,
    targetSets: rec.action === 'add_set' ? input.prescription.sets : rec.targetSets,
    flags: [...rec.flags, 'readiness']
  };
}

// ── History extraction ──────────────────────────────────────────────────────

/**
 * Past performances of one exercise from completed, non-deleted sessions. In-progress sessions and the
 * session being logged are excluded, so today's partial sets never feed back into today's suggestion.
 */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: ID, opts: { excludeSessionId?: ID } = {}): ExerciseHistoryEntry[] {
  const out: ExerciseHistoryEntry[] = [];
  for (const s of sessions) {
    if (s.deletedAt || s.status !== 'completed' || s.id === opts.excludeSessionId) continue;
    for (const se of s.exercises) {
      if (se.exerciseId !== exerciseId || se.skipped) continue;
      if (!se.sets.some((x) => x.completed)) continue;
      out.push({ sessionId: s.id, date: s.date, timestamp: s.endedAt ?? s.startedAt, loadMode: se.loadMode, prescription: se.prescription, sets: se.sets });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? b.timestamp.localeCompare(a.timestamp) : b.date.localeCompare(a.date)));
}
