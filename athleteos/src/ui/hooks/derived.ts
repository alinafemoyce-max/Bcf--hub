import type { Exercise, ID, ISODate, LoadMode, Prescription, RecoveryCheck, WorkoutTemplate } from '@/domain/types';
import { exerciseHistory, recommend, recommendIgnoringReadiness, type Recommendation } from '@/domain/overload';
import { assessReadiness, type ReadinessAssessment } from '@/domain/readiness';
import { templateForDay } from '@/domain/reminders';
import { addDays, weekdayOf } from '@/lib/dates';
import type { AppData } from './useAppData';

export function recommendationFor(
  data: AppData,
  exercise: Exercise,
  prescription: Prescription,
  loadMode: LoadMode,
  opts: { readiness?: ReadinessAssessment | null; excludeSessionId?: ID } = {}
): Recommendation {
  const profile = data.profile!;
  return recommend({
    exercise,
    prescription,
    loadMode,
    history: exerciseHistory(data.sessions, exercise.id, { excludeSessionId: opts.excludeSessionId }),
    increments: profile.increments,
    units: profile.units,
    readiness: opts.readiness ?? null
  });
}

export function todaysCheck(data: AppData): RecoveryCheck | undefined {
  return data.recovery.find((r) => r.date === data.today);
}

export function readinessFor(check: RecoveryCheck | null | undefined): ReadinessAssessment {
  return assessReadiness(check ?? null);
}

export interface ReadyItem {
  exerciseId: ID;
  name: string;
  rec: Recommendation;
  templateName: string;
}

/** Exercises in the programme whose last performance says it's time to progress. */
export function readyForOverload(data: AppData): ReadyItem[] {
  const profile = data.profile!;
  const seen = new Set<ID>();
  const out: ReadyItem[] = [];
  for (const t of data.templates) {
    for (const te of t.exercises) {
      if (seen.has(te.exerciseId)) continue;
      const ex = data.exerciseMap.get(te.exerciseId);
      if (!ex || ex.deletedAt || ex.progressionType === 'conditioning' || ex.progressionType === 'mobility') continue;
      const history = exerciseHistory(data.sessions, ex.id);
      if (!history.length) continue;
      const rec = recommendIgnoringReadiness({ exercise: ex, prescription: te.prescription, loadMode: history[0].loadMode, history, increments: profile.increments, units: profile.units });
      if (rec.readyForOverload) {
        seen.add(ex.id);
        out.push({ exerciseId: ex.id, name: ex.name, rec, templateName: t.name });
      }
    }
  }
  return out;
}

export function scheduledFor(data: AppData, date: ISODate): WorkoutTemplate | undefined {
  return templateForDay(data.templates, weekdayOf(date), data.profile?.trainingDays ?? []);
}

/** The next scheduled workout after today (or today's, if not done yet). */
export function nextWorkout(data: AppData, includeToday: boolean): { template: WorkoutTemplate; date: ISODate } | null {
  for (let i = includeToday ? 0 : 1; i <= 7; i++) {
    const d = addDays(data.today, i);
    const t = scheduledFor(data, d);
    if (t) return { template: t, date: d };
  }
  return null;
}

export function latestBodyWeight(data: AppData): { kg: number; date: ISODate | null } | null {
  const b = data.body[0];
  if (b) return { kg: b.weightKg, date: b.date };
  if (data.profile?.bodyWeightKg) return { kg: data.profile.bodyWeightKg, date: null };
  return null;
}

export function activeSession(data: AppData) {
  return data.sessions.find((s) => s.status === 'in_progress');
}
