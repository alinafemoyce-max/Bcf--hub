import type { Exercise, ID, ISODate, LoadMode, Prescription, SessionExercise, SetLog, UserProfile, WorkoutFocus, WorkoutSession, WorkoutTemplate } from './types';
import { exerciseHistory, recommend, type Recommendation } from './overload';
import type { ReadinessAssessment } from './readiness';
import { newId } from '@/lib/id';

export function emptySet(): SetLog {
  return { id: newId(), completed: false };
}

/** The load mode last used for this exercise, so a dumbbell lift keeps being logged the same way. */
export function preferredLoadMode(exercise: Exercise, sessions: WorkoutSession[]): LoadMode {
  const h = exerciseHistory(sessions, exercise.id);
  return h[0]?.loadMode ?? exercise.defaultLoadMode;
}

/** Pre-filled sets for fast logging: the suggestion becomes the starting value, which you then adjust. */
export function prefillSets(exercise: Exercise, p: Prescription, rec: Recommendation | null, count = p.sets): SetLog[] {
  const out: SetLog[] = [];
  for (let i = 0; i < Math.max(1, count); i++) out.push(prefillSet(exercise, p, rec));
  return out;
}

export function prefillSet(exercise: Exercise, p: Prescription, rec: Recommendation | null, previous?: SetLog): SetLog {
  const s = emptySet();
  switch (exercise.progressionType) {
    case 'double_progression':
      s.weightKg = previous?.weightKg ?? rec?.suggestedWeightKg ?? null;
      s.reps = previous?.reps ?? rec?.targetReps ?? p.repsMax ?? p.repsMin ?? null;
      break;
    case 'bodyweight_reps':
      s.reps = previous?.reps ?? rec?.targetReps ?? p.repsMax ?? p.repsMin ?? null;
      break;
    case 'timed_hold':
      s.durationSec = previous?.durationSec ?? rec?.targetDurationSec ?? p.durationSec ?? null;
      break;
    case 'mobility':
      if (p.durationSec) s.durationSec = p.durationSec;
      else s.reps = p.repsMax ?? p.repsMin ?? null;
      break;
    case 'sprint':
    case 'agility':
      s.distanceM = p.distanceM ?? null;
      break;
    case 'jump':
      s.reps = p.repsMax ?? p.repsMin ?? null;
      break;
    case 'conditioning':
      s.durationSec = p.durationSec ?? null;
      break;
  }
  return s;
}

export interface CreateSessionInput {
  template: WorkoutTemplate | null;
  name?: string;
  focus?: WorkoutFocus;
  date: ISODate;
  now: string;
  exercises: Map<ID, Exercise>;
  sessions: WorkoutSession[];
  profile: UserProfile;
  readiness?: ReadinessAssessment | null;
  recoveryCheckId?: ID | null;
  source?: 'live' | 'manual';
}

export function buildSessionExercise(exercise: Exercise, prescription: Prescription, input: Pick<CreateSessionInput, 'sessions' | 'profile' | 'readiness'>, prefill = true): SessionExercise {
  const loadMode = preferredLoadMode(exercise, input.sessions);
  const rec = recommend({
    exercise,
    prescription,
    loadMode,
    history: exerciseHistory(input.sessions, exercise.id),
    increments: input.profile.increments,
    units: input.profile.units,
    readiness: input.readiness ?? null
  });
  return {
    id: newId(),
    exerciseId: exercise.id,
    prescription: { ...prescription },
    loadMode,
    sets: prefill ? prefillSets(exercise, prescription, rec) : [emptySet()],
    recommendationText: rec.headline
  };
}

export function createSession(input: CreateSessionInput): WorkoutSession {
  const { template } = input;
  const items = template ? template.exercises : [];
  const exercises: SessionExercise[] = [];
  for (const te of items) {
    const ex = input.exercises.get(te.exerciseId);
    if (!ex || ex.deletedAt) continue;
    exercises.push(buildSessionExercise(ex, te.prescription, input));
  }
  return {
    id: newId(),
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null,
    templateId: template?.id ?? null,
    name: input.name ?? template?.name ?? 'Workout',
    focus: input.focus ?? template?.focus ?? 'custom',
    date: input.date,
    startedAt: input.now,
    endedAt: null,
    status: 'in_progress',
    source: input.source ?? 'live',
    exercises,
    notes: '',
    recoveryCheckId: input.recoveryCheckId ?? null,
    restEndsAt: null,
    revision: 0
  };
}

/** Marks a live session finished. Untouched, uncompleted sets are kept but never count as performed. */
export function finishSession(session: WorkoutSession, now: string): WorkoutSession {
  return { ...session, status: 'completed', endedAt: now, restEndsAt: null, updatedAt: now };
}

export function sessionProgress(session: WorkoutSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const se of session.exercises) {
    if (se.skipped) continue;
    total += se.sets.length;
    done += se.sets.filter((s) => s.completed).length;
  }
  return { done, total };
}
