import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '@/data';
import type { BodyMeasurement, Exercise, ID, ISODate, RecoveryCheck, UserProfile, WorkoutSession, WorkoutTemplate } from '@/domain/types';
import { todayISO } from '@/lib/dates';

export interface AppData {
  profile: UserProfile | undefined;
  exercises: Exercise[];
  /** Includes soft-deleted exercises, so old sessions still show names. */
  exerciseMap: Map<ID, Exercise>;
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  recovery: RecoveryCheck[];
  body: BodyMeasurement[];
  dismissed: Record<string, ISODate>;
  today: ISODate;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    // Roll the date over at midnight and when the app returns from the background.
    const tick = () => setToday(todayISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const profile = useLiveQuery(async () => (await repo.getProfile()) ?? null, []);
  const allExercises = useLiveQuery(() => repo.listExercises({ includeDeleted: true }), []);
  const templates = useLiveQuery(() => repo.listTemplates(), []);
  const sessions = useLiveQuery(() => repo.listSessions(), []);
  const recovery = useLiveQuery(() => repo.listRecovery(), []);
  const body = useLiveQuery(() => repo.listBody(), []);
  const dismissed = useLiveQuery(async () => (await repo.getMeta<Record<string, ISODate>>('reminders.dismissed')) ?? {}, []);

  const value = useMemo<AppData | null>(() => {
    if (profile === undefined || !allExercises || !templates || !sessions || !recovery || !body || !dismissed) return null;
    return {
      profile: profile ?? undefined,
      exercises: allExercises.filter((e) => !e.deletedAt),
      exerciseMap: new Map(allExercises.map((e) => [e.id, e])),
      templates,
      sessions,
      recovery,
      body,
      dismissed,
      today
    };
  }, [profile, allExercises, templates, sessions, recovery, body, dismissed, today]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside AppDataProvider');
  return v;
}

/** Profile is guaranteed after onboarding. */
export function useProfile(): UserProfile {
  const { profile } = useAppData();
  if (!profile) throw new Error('Profile missing');
  return profile;
}
