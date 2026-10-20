import type { Exercise, ID, ISODate, LoadMode, MuscleGroup, PersonalRecord, SessionExercise, SetLog, Weekday, WorkoutSession, WorkoutTemplate } from './types';
import { addDays, daysBetween, startOfWeek, weekdayOf } from '@/lib/dates';

// Everything here is calculated from logged sessions only — nothing is estimated or invented.
// Series are always per exercise id *and* load mode, so variations are never compared directly.

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const activeSessions = (sessions: WorkoutSession[]) => sessions.filter((s) => !s.deletedAt);
export const completedSessions = (sessions: WorkoutSession[]) => sessions.filter((s) => !s.deletedAt && s.status === 'completed');

/** Epley estimate. Only meaningful for 1–12 reps; returns null outside that. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (!isNum(weightKg) || !isNum(reps) || weightKg <= 0 || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

const loadFactor = (mode: LoadMode) => (mode === 'per_dumbbell' ? 2 : 1);

/** Volume load (kg × reps) of one set. Per-dumbbell loads count both dumbbells; per-side reps count both sides. */
export function setVolume(set: SetLog, se: Pick<SessionExercise, 'loadMode' | 'prescription'>): number {
  if (!set.completed || !isNum(set.weightKg) || !isNum(set.reps) || set.weightKg <= 0 || set.reps <= 0) return 0;
  return set.weightKg * loadFactor(se.loadMode) * set.reps * (se.prescription.perSide ? 2 : 1);
}

export function exerciseVolume(se: SessionExercise): number {
  return se.skipped ? 0 : se.sets.reduce((sum, s) => sum + setVolume(s, se), 0);
}

export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((sum, se) => sum + exerciseVolume(se), 0);
}

export function sessionDurationMin(session: WorkoutSession): number | null {
  if (isNum(session.durationMin)) return session.durationMin;
  if (!session.endedAt) return null;
  const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

export function completedSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((n, se) => n + (se.skipped ? 0 : se.sets.filter((s) => s.completed).length), 0);
}

export function sessionsInRange(sessions: WorkoutSession[], from: ISODate, to: ISODate): WorkoutSession[] {
  return completedSessions(sessions).filter((s) => s.date >= from && s.date <= to);
}

// ── Personal records ────────────────────────────────────────────────────────

type PRKey = string;
const prKey = (exerciseId: ID, kind: string, loadMode: LoadMode, extra = '') => `${exerciseId}|${kind}|${loadMode}|${extra}`;

/**
 * Walks every completed session in date order and tracks the best value per exercise / record type /
 * load mode. Returns the final bests and every "improvement event" (a session beating the previous best).
 * Because PRs are derived, editing or deleting a past session can never leave a stale record behind.
 */
function walkRecords(sessions: WorkoutSession[], exercises: Map<ID, Exercise>): { best: PersonalRecord[]; events: PersonalRecord[] } {
  const best = new Map<PRKey, PersonalRecord>();
  const events: PersonalRecord[] = [];
  const ordered = completedSessions(sessions)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.endedAt ?? a.startedAt).localeCompare(b.endedAt ?? b.startedAt) : a.date.localeCompare(b.date)));
  for (const s of ordered) {
    // Best per key within this session, so three sets beating the old best count as one record.
    const sessionBest = new Map<PRKey, { pr: PersonalRecord; higher: boolean }>();
    const consider = (key: PRKey, pr: PersonalRecord, higher = true) => {
      const cur = sessionBest.get(key);
      if (!cur || (higher ? pr.value > cur.pr.value + 1e-9 : pr.value < cur.pr.value - 1e-9)) sessionBest.set(key, { pr, higher });
    };
    for (const se of s.exercises) {
      if (se.skipped) continue;
      const ex = exercises.get(se.exerciseId);
      if (!ex) continue;
      const base = { exerciseId: se.exerciseId, loadMode: se.loadMode, sessionId: s.id, date: s.date };
      for (const set of se.sets) {
        if (!set.completed) continue;
        switch (ex.progressionType) {
          case 'double_progression': {
            if (!isNum(set.weightKg) || !isNum(set.reps) || set.reps <= 0) break;
            if (set.weightKg > 0) {
              consider(prKey(se.exerciseId, 'heaviest_weight', se.loadMode), { ...base, kind: 'heaviest_weight', value: set.weightKg, weightKg: set.weightKg, reps: set.reps });
              if (ex.e1rmSuitable) {
                const e = estimate1RM(set.weightKg, set.reps);
                if (e) consider(prKey(se.exerciseId, 'best_e1rm', se.loadMode), { ...base, kind: 'best_e1rm', value: Math.round(e * 10) / 10, weightKg: set.weightKg, reps: set.reps });
              }
            }
            consider(prKey(se.exerciseId, 'most_reps_at_weight', se.loadMode, String(set.weightKg)), { ...base, kind: 'most_reps_at_weight', value: set.reps, weightKg: set.weightKg, reps: set.reps });
            break;
          }
          case 'bodyweight_reps':
            if (isNum(set.reps) && set.reps > 0) consider(prKey(se.exerciseId, 'most_reps', se.loadMode), { ...base, kind: 'most_reps', value: set.reps, reps: set.reps });
            break;
          case 'timed_hold':
            if (isNum(set.durationSec) && set.durationSec > 0) consider(prKey(se.exerciseId, 'longest_hold', se.loadMode), { ...base, kind: 'longest_hold', value: set.durationSec });
            break;
          case 'sprint':
          case 'agility':
            if (isNum(set.timeSec) && set.timeSec > 0) {
              const d = set.distanceM ?? se.prescription.distanceM ?? null;
              consider(prKey(se.exerciseId, 'fastest_time', se.loadMode, String(d)), { ...base, kind: 'fastest_time', value: set.timeSec, distanceM: d }, false);
            }
            break;
          case 'jump':
            if (isNum(set.distanceM) && set.distanceM > 0 && set.technique !== 'poor') consider(prKey(se.exerciseId, 'longest_jump', se.loadMode), { ...base, kind: 'longest_jump', value: set.distanceM });
            break;
          default:
            break;
        }
      }
    }
    for (const [key, { pr, higher }] of sessionBest) {
      const cur = best.get(key);
      if (!cur) best.set(key, pr); // first performance: a baseline, not a "new record" event
      else if (higher ? pr.value > cur.value + 1e-9 : pr.value < cur.value - 1e-9) {
        best.set(key, pr);
        events.push(pr);
      }
    }
  }
  return { best: [...best.values()], events };
}

/** All-time personal records (current bests). */
export function computePersonalRecords(sessions: WorkoutSession[], exercises: Map<ID, Exercise>): PersonalRecord[] {
  return walkRecords(sessions, exercises).best;
}

/** Every time a session beat the previous best — "PR!" moments, as they happened. */
export function personalRecordEvents(sessions: WorkoutSession[], exercises: Map<ID, Exercise>): PersonalRecord[] {
  return walkRecords(sessions, exercises).events;
}

/** Headline PRs (excludes the per-weight rep records, which are mainly used for "PR!" badges). */
export function headlinePRs(prs: PersonalRecord[]): PersonalRecord[] {
  return prs.filter((p) => p.kind !== 'most_reps_at_weight');
}

/** Records a session set at the time (it beat every earlier session). */
export function prsSetInSession(sessions: WorkoutSession[], sessionId: ID, exercises: Map<ID, Exercise>): PersonalRecord[] {
  return headlinePRs(personalRecordEvents(sessions, exercises)).filter((p) => p.sessionId === sessionId);
}

// ── Weekly stats & consistency ──────────────────────────────────────────────

export interface WeekStats {
  weekStart: ISODate;
  completed: number;
  planned: number;
  volumeKg: number;
  minutes: number;
}

export function plannedDaysPerWeek(templates: WorkoutTemplate[], trainingDays: Weekday[]): number {
  const scheduled = new Set(templates.filter((t) => !t.deletedAt && t.dayOfWeek != null).map((t) => t.dayOfWeek as Weekday));
  const days = trainingDays.length ? trainingDays.filter((d) => scheduled.has(d)) : [...scheduled];
  return days.length;
}

export function weekStats(sessions: WorkoutSession[], weekStart: ISODate, planned: number): WeekStats {
  const inWeek = sessionsInRange(sessions, weekStart, addDays(weekStart, 6));
  const days = new Set(inWeek.map((s) => s.date));
  return {
    weekStart,
    completed: days.size,
    planned,
    volumeKg: inWeek.reduce((sum, s) => sum + sessionVolume(s), 0),
    minutes: inWeek.reduce((sum, s) => sum + (sessionDurationMin(s) ?? 0), 0)
  };
}

/** The last `count` weeks (oldest first), ending with the week containing `today`. */
export function recentWeeks(sessions: WorkoutSession[], today: ISODate, count: number, planned: number): WeekStats[] {
  const thisWeek = startOfWeek(today);
  const out: WeekStats[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(weekStats(sessions, addDays(thisWeek, -7 * i), planned));
  return out;
}

/**
 * Share of planned sessions completed over the last `weeks` weeks (current week included).
 * Counting starts at `since` (the day tracking began, e.g. onboarding) so days before you used the app never
 * count as missed, and today only counts once it has been trained. Workouts on unscheduled days count too
 * (capped at 100%).
 */
export function consistencyPercent(
  sessions: WorkoutSession[],
  today: ISODate,
  weeks: number,
  templates: WorkoutTemplate[],
  trainingDays: Weekday[],
  since?: ISODate | null
): number | null {
  const scheduledDays = new Set(templates.filter((t) => !t.deletedAt && t.dayOfWeek != null && (trainingDays.length === 0 || trainingDays.includes(t.dayOfWeek))).map((t) => t.dayOfWeek as Weekday));
  if (scheduledDays.size === 0) return null;
  const done = new Set(completedSessions(sessions).map((s) => s.date));
  const firstSession = completedSessions(sessions).reduce<ISODate | null>((min, s) => (!min || s.date < min ? s.date : min), null);
  const windowStart = addDays(startOfWeek(today), -7 * (weeks - 1));
  const tracking = since ?? firstSession;
  if (!tracking) return null;
  const start = tracking > windowStart ? tracking : windowStart;
  let planned = 0;
  let hit = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const scheduled = scheduledDays.has(weekdayOf(d));
    if (d === today && !done.has(d)) continue; // today isn't missed until it's over
    if (scheduled) planned++;
    if (done.has(d)) hit++;
  }
  return planned === 0 ? null : Math.min(100, Math.round((hit / planned) * 100));
}

// ── Muscles trained recently ────────────────────────────────────────────────

export interface MuscleRecency {
  muscle: MuscleGroup;
  lastDate: ISODate;
  daysAgo: number;
  sets: number;
}

export function musclesTrainedRecently(sessions: WorkoutSession[], exercises: Map<ID, Exercise>, today: ISODate, windowDays = 7): MuscleRecency[] {
  const from = addDays(today, -(windowDays - 1));
  const map = new Map<MuscleGroup, MuscleRecency>();
  for (const s of sessionsInRange(sessions, from, today)) {
    for (const se of s.exercises) {
      if (se.skipped) continue;
      const ex = exercises.get(se.exerciseId);
      if (!ex) continue;
      const done = se.sets.filter((x) => x.completed).length;
      if (!done) continue;
      for (const m of ex.primaryMuscles) {
        if (m === 'cardio') continue;
        const cur = map.get(m);
        if (!cur) map.set(m, { muscle: m, lastDate: s.date, daysAgo: daysBetween(s.date, today), sets: done });
        else {
          cur.sets += done;
          if (s.date > cur.lastDate) {
            cur.lastDate = s.date;
            cur.daysAgo = daysBetween(s.date, today);
          }
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => a.daysAgo - b.daysAgo || b.sets - a.sets);
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  lats: 'Lats',
  upper_back: 'Upper back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  hip_flexors: 'Hip flexors',
  adductors: 'Adductors',
  spine: 'Spine',
  ankles: 'Ankles',
  cardio: 'Cardio'
};

// ── Per-exercise series (charts) ────────────────────────────────────────────

export interface ExercisePoint {
  date: ISODate;
  sessionId: ID;
  topWeightKg: number | null;
  totalReps: number;
  bestReps: number | null;
  volumeKg: number;
  e1rmKg: number | null;
  bestTimeSec: number | null;
  bestDistanceM: number | null;
  bestDurationSec: number | null;
  avgRom: number | null;
  avgControl: number | null;
}

/** One point per completed session for an exercise, logged with one load mode, oldest first. */
export function exerciseSeries(sessions: WorkoutSession[], exercise: Exercise, loadMode: LoadMode, from?: ISODate): ExercisePoint[] {
  const pts: ExercisePoint[] = [];
  for (const s of completedSessions(sessions)) {
    if (from && s.date < from) continue;
    for (const se of s.exercises) {
      if (se.exerciseId !== exercise.id || se.skipped || se.loadMode !== loadMode) continue;
      const done = se.sets.filter((x) => x.completed);
      if (!done.length) continue;
      const weights = done.map((x) => x.weightKg).filter((w): w is number => isNum(w) && w > 0);
      const reps = done.map((x) => x.reps).filter(isNum);
      const e1rms = exercise.e1rmSuitable ? done.map((x) => (isNum(x.weightKg) && isNum(x.reps) ? estimate1RM(x.weightKg, x.reps) : null)).filter(isNum) : [];
      const times = done.map((x) => x.timeSec).filter((t): t is number => isNum(t) && t > 0);
      const dists = done.filter((x) => x.technique !== 'poor').map((x) => x.distanceM).filter((d): d is number => isNum(d) && d > 0);
      const durs = done.map((x) => x.durationSec).filter((d): d is number => isNum(d) && d > 0);
      const roms = done.map((x) => x.rom).filter(isNum);
      const ctrls = done.map((x) => x.control).filter(isNum);
      const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
      pts.push({
        date: s.date,
        sessionId: s.id,
        topWeightKg: weights.length ? Math.max(...weights) : null,
        totalReps: reps.reduce((a, b) => a + b, 0),
        bestReps: reps.length ? Math.max(...reps) : null,
        volumeKg: exerciseVolume(se),
        e1rmKg: e1rms.length ? Math.round(Math.max(...e1rms) * 10) / 10 : null,
        bestTimeSec: times.length ? Math.min(...times) : null,
        bestDistanceM: dists.length ? Math.max(...dists) : null,
        bestDurationSec: durs.length ? Math.max(...durs) : null,
        avgRom: mean(roms),
        avgControl: mean(ctrls)
      });
    }
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

/** Load modes an exercise has actually been logged with (each is charted separately). */
export function loggedLoadModes(sessions: WorkoutSession[], exerciseId: ID): LoadMode[] {
  const modes = new Set<LoadMode>();
  for (const s of completedSessions(sessions)) for (const se of s.exercises) if (se.exerciseId === exerciseId && !se.skipped && se.sets.some((x) => x.completed)) modes.add(se.loadMode);
  return [...modes];
}
