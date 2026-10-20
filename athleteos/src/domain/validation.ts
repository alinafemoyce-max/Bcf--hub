import type { BodyMeasurement, Exercise, Prescription, SetLog, WorkoutSession, WorkoutTemplate } from './types';
import { isValidISODate } from '@/lib/dates';

// Validation guards every write, so a bad edit can't corrupt history or the analytics derived from it.

export class ValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join(' '));
    this.name = 'ValidationError';
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown) => v == null || isNum(v);

export const LIMITS = {
  weightKg: 500,
  reps: 200,
  durationSec: 4 * 3600,
  distanceM: 10_000,
  timeSec: 3600,
  rir: 10,
  sets: 20,
  bodyWeightKg: [30, 250] as const
};

export function setIssues(set: SetLog, label: string): string[] {
  const out: string[] = [];
  const range = (v: number | null | undefined, lo: number, hi: number, what: string) => {
    if (v == null) return;
    if (!isNum(v) || v < lo || v > hi) out.push(`${label}: ${what} must be between ${lo} and ${hi}.`);
  };
  range(set.weightKg, 0, LIMITS.weightKg, 'weight');
  range(set.reps, 0, LIMITS.reps, 'reps');
  if (set.reps != null && isNum(set.reps) && !Number.isInteger(set.reps)) out.push(`${label}: reps must be a whole number.`);
  range(set.durationSec, 0, LIMITS.durationSec, 'duration');
  range(set.distanceM, 0, LIMITS.distanceM, 'distance');
  range(set.timeSec, 0, LIMITS.timeSec, 'time');
  range(set.restSec, 0, LIMITS.durationSec, 'rest');
  range(set.rir, 0, LIMITS.rir, 'reps in reserve');
  range(set.rom, 1, 5, 'range of motion rating');
  range(set.control, 1, 5, 'control rating');
  if (set.technique != null && !['good', 'ok', 'poor'].includes(set.technique)) out.push(`${label}: unknown technique rating.`);
  if (typeof set.completed !== 'boolean') out.push(`${label}: completed must be true or false.`);
  return out;
}

export function prescriptionIssues(p: Prescription, label: string): string[] {
  const out: string[] = [];
  if (!isNum(p.sets) || !Number.isInteger(p.sets) || p.sets < 1 || p.sets > LIMITS.sets) out.push(`${label}: sets must be 1–${LIMITS.sets}.`);
  if (!optNum(p.repsMin) || !optNum(p.repsMax)) out.push(`${label}: reps must be numbers.`);
  if (isNum(p.repsMin) && isNum(p.repsMax) && p.repsMin > p.repsMax) out.push(`${label}: minimum reps can’t exceed maximum reps.`);
  if (isNum(p.repsMin) && (p.repsMin < 1 || p.repsMin > LIMITS.reps)) out.push(`${label}: reps out of range.`);
  if (!optNum(p.durationSec) || (isNum(p.durationSec) && p.durationSec <= 0)) out.push(`${label}: duration must be positive.`);
  if (!optNum(p.distanceM) || (isNum(p.distanceM) && p.distanceM <= 0)) out.push(`${label}: distance must be positive.`);
  return out;
}

export function validateSession(s: WorkoutSession): string[] {
  const out: string[] = [];
  if (!s.id) out.push('Session is missing an id.');
  if (!s.name?.trim()) out.push('Workout name is required.');
  if (!isValidISODate(s.date)) out.push('Workout date is invalid.');
  if (!['in_progress', 'completed'].includes(s.status)) out.push('Unknown workout status.');
  if (s.durationMin != null && (!isNum(s.durationMin) || s.durationMin < 0 || s.durationMin > 600)) out.push('Duration must be 0–600 minutes.');
  if (!Array.isArray(s.exercises)) out.push('Exercises are missing.');
  else
    s.exercises.forEach((se, i) => {
      const label = `Exercise ${i + 1}`;
      if (!se.exerciseId) out.push(`${label}: missing exercise.`);
      out.push(...prescriptionIssues(se.prescription, label));
      se.sets.forEach((set, j) => out.push(...setIssues(set, `${label}, set ${j + 1}`)));
    });
  return out;
}

export function validateTemplate(t: WorkoutTemplate): string[] {
  const out: string[] = [];
  if (!t.name?.trim()) out.push('Workout name is required.');
  if (t.dayOfWeek != null && (!Number.isInteger(t.dayOfWeek) || t.dayOfWeek < 1 || t.dayOfWeek > 7)) out.push('Day must be Monday–Sunday.');
  t.exercises.forEach((te, i) => out.push(...prescriptionIssues(te.prescription, `Exercise ${i + 1}`)));
  return out;
}

export function validateExercise(e: Exercise): string[] {
  const out: string[] = [];
  if (!e.name?.trim()) out.push('Exercise name is required.');
  if (e.name && e.name.length > 80) out.push('Exercise name is too long.');
  if (!isNum(e.restSeconds) || e.restSeconds < 0 || e.restSeconds > 900) out.push('Rest must be 0–900 seconds.');
  if (e.incrementKg != null && (!isNum(e.incrementKg) || e.incrementKg <= 0 || e.incrementKg > 50)) out.push('Increment must be between 0 and 50 kg.');
  if (e.demoUrl && !/^https?:\/\//i.test(e.demoUrl)) out.push('Demonstration link must start with http:// or https://.');
  if (!e.primaryMuscles?.length) out.push('Choose at least one primary muscle.');
  return out;
}

export function validateBody(b: BodyMeasurement): string[] {
  const out: string[] = [];
  if (!isValidISODate(b.date)) out.push('Date is invalid.');
  const [lo, hi] = LIMITS.bodyWeightKg;
  if (!isNum(b.weightKg) || b.weightKg < lo || b.weightKg > hi) out.push(`Body weight must be between ${lo} and ${hi} kg.`);
  return out;
}

export function assertValid(issues: string[]) {
  if (issues.length) throw new ValidationError(issues);
}
