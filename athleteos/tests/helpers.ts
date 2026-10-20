import type { Exercise, IncrementSettings, LoadMode, Prescription, SetLog, TechniqueQuality, WorkoutSession } from '@/domain/types';
import type { ExerciseHistoryEntry } from '@/domain/overload';
import { builtinExercises } from '@/data/seed';

export const NOW = '2026-10-19T10:00:00.000Z';
export const INC: IncrementSettings = { upperKg: 2.5, lowerKg: 5, dumbbellKg: 2 };

const library = new Map(builtinExercises(NOW).map((e) => [e.builtinKey!, e]));
export function ex(key: string, overrides: Partial<Exercise> = {}): Exercise {
  const e = library.get(key);
  if (!e) throw new Error(`no exercise ${key}`);
  return { ...e, ...overrides };
}
export const exerciseMap = () => new Map(builtinExercises(NOW).map((e) => [e.id, e]));

let n = 0;
export interface SetSpec {
  w?: number;
  r?: number;
  rir?: number | null;
  t?: TechniqueQuality | null;
  done?: boolean;
  time?: number;
  dist?: number;
  dur?: number;
  rest?: number;
  rom?: number;
  control?: number;
}
export function set(s: SetSpec): SetLog {
  return {
    id: `set-${++n}`,
    weightKg: s.w ?? null,
    reps: s.r ?? null,
    rir: s.rir === undefined ? 2 : s.rir,
    technique: s.t === undefined ? 'good' : s.t,
    completed: s.done ?? true,
    timeSec: s.time ?? null,
    distanceM: s.dist ?? null,
    durationSec: s.dur ?? null,
    restSec: s.rest ?? null,
    rom: s.rom ?? null,
    control: s.control ?? null
  };
}
/** Shorthand: weight and a list of reps, all good technique at 2 RIR unless overridden. */
export const lifts = (w: number, reps: number[], extra: Partial<SetSpec> = {}) => reps.map((r) => set({ w, r, ...extra }));

export function entry(date: string, sets: SetLog[], prescription: Prescription, loadMode: LoadMode = 'total'): ExerciseHistoryEntry {
  return { sessionId: `s-${date}`, date, timestamp: `${date}T18:00:00.000Z`, loadMode, prescription, sets };
}

export function session(date: string, exerciseId: string, sets: SetLog[], prescription: Prescription, opts: Partial<WorkoutSession> & { loadMode?: LoadMode } = {}): WorkoutSession {
  const { loadMode = 'total', ...rest } = opts;
  return {
    id: `sess-${date}-${exerciseId}`,
    createdAt: `${date}T17:00:00.000Z`,
    updatedAt: `${date}T18:00:00.000Z`,
    deletedAt: null,
    templateId: null,
    name: 'Test',
    focus: 'custom',
    date,
    startedAt: `${date}T17:00:00.000Z`,
    endedAt: `${date}T18:00:00.000Z`,
    status: 'completed',
    source: 'live',
    exercises: [{ id: `se-${date}`, exerciseId, prescription, loadMode, sets }],
    notes: '',
    revision: 0,
    ...rest
  };
}
