import type { BodyMeasurement, Exercise, ID, RecoveryCheck, SessionRevision, UserProfile, WorkoutSession, WorkoutTemplate } from '@/domain/types';
import { assertValid, validateBody, validateExercise, validateSession, validateTemplate } from '@/domain/validation';
import { newId, nowISO } from '@/lib/id';
import { todayISO, startOfWeek } from '@/lib/dates';
import { AthleteDB } from './db';
import { builtinExercises, defaultProgramme } from './seed';

/**
 * Storage boundary for the app. The UI only talks to this interface, so a cloud implementation
 * (e.g. Supabase with row-level security, syncing on `updatedAt` / `deletedAt`) can replace or wrap
 * the local one later without touching screens or the training logic.
 */
export interface AthleteRepository {
  init(): Promise<void>;
  getProfile(): Promise<UserProfile | undefined>;
  saveProfile(p: UserProfile): Promise<void>;

  listExercises(opts?: { includeDeleted?: boolean }): Promise<Exercise[]>;
  saveExercise(e: Exercise): Promise<void>;
  deleteExercise(id: ID): Promise<void>;

  listTemplates(): Promise<WorkoutTemplate[]>;
  saveTemplate(t: WorkoutTemplate): Promise<void>;
  deleteTemplate(id: ID): Promise<void>;
  resetProgramme(): Promise<void>;

  listSessions(): Promise<WorkoutSession[]>;
  getSession(id: ID): Promise<WorkoutSession | undefined>;
  activeSession(): Promise<WorkoutSession | undefined>;
  /** Autosave for in-progress (and new) sessions. */
  saveSession(s: WorkoutSession): Promise<void>;
  /** Edit an already completed session: snapshots the previous version first. */
  editCompletedSession(s: WorkoutSession): Promise<WorkoutSession>;
  deleteSession(id: ID): Promise<void>;
  listRevisions(sessionId: ID): Promise<SessionRevision[]>;
  restoreRevision(revisionId: ID): Promise<WorkoutSession>;

  listRecovery(): Promise<RecoveryCheck[]>;
  saveRecovery(r: RecoveryCheck): Promise<void>;

  listBody(): Promise<BodyMeasurement[]>;
  saveBody(b: BodyMeasurement): Promise<void>;
  deleteBody(id: ID): Promise<void>;

  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
  clearAll(): Promise<void>;
}

export function defaultProfile(now = nowISO()): UserProfile {
  return {
    id: 'me',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    experience: 'returning',
    equipment: ['dumbbell', 'cable', 'machine', 'barbell', 'bench', 'bike', 'box', 'field', 'cones', 'bodyweight'],
    units: 'kg',
    trainingDays: [1, 2, 3, 4, 5],
    increments: { upperKg: 2.5, lowerKg: 5, dumbbellKg: 2 },
    programmeStartDate: startOfWeek(todayISO()),
    bodyWeightKg: null,
    injuries: '',
    onboardedAt: null
  };
}

const alive = <T extends { deletedAt?: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export class DexieRepository implements AthleteRepository {
  constructor(public db: AthleteDB = new AthleteDB()) {}

  /** Seeds built-in exercises (non-destructively) and the default programme on first run. */
  async init(): Promise<void> {
    const now = nowISO();
    await this.db.transaction('rw', this.db.exercises, this.db.templates, this.db.meta, async () => {
      const existing = new Set((await this.db.exercises.toArray()).map((e) => e.id));
      const missing = builtinExercises(now).filter((e) => !existing.has(e.id));
      if (missing.length) await this.db.exercises.bulkAdd(missing);
      const seeded = await this.db.meta.get('programmeSeeded');
      if (!seeded) {
        if ((await this.db.templates.count()) === 0) await this.db.templates.bulkAdd(defaultProgramme(now));
        await this.db.meta.put({ key: 'programmeSeeded', value: now });
      }
    });
  }

  async getProfile() {
    return this.db.profile.get('me');
  }

  async saveProfile(p: UserProfile) {
    await this.db.profile.put({ ...p, id: 'me', updatedAt: nowISO() });
  }

  async listExercises(opts: { includeDeleted?: boolean } = {}) {
    const rows = await this.db.exercises.toArray();
    const list = opts.includeDeleted ? rows : alive(rows);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveExercise(e: Exercise) {
    assertValid(validateExercise(e));
    await this.db.exercises.put({ ...e, name: e.name.trim(), updatedAt: nowISO() });
  }

  /** Soft delete so past sessions that used the exercise still display correctly. */
  async deleteExercise(id: ID) {
    const now = nowISO();
    await this.db.transaction('rw', this.db.exercises, this.db.templates, async () => {
      await this.db.exercises.update(id, { deletedAt: now, updatedAt: now });
      const templates = await this.db.templates.toArray();
      for (const t of templates) {
        if (t.exercises.some((te) => te.exerciseId === id)) {
          await this.db.templates.put({ ...t, exercises: t.exercises.filter((te) => te.exerciseId !== id), updatedAt: now });
        }
      }
    });
  }

  async listTemplates() {
    const rows = alive(await this.db.templates.toArray());
    return rows.sort((a, b) => (a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99) || a.name.localeCompare(b.name));
  }

  async saveTemplate(t: WorkoutTemplate) {
    assertValid(validateTemplate(t));
    await this.db.templates.put({ ...t, name: t.name.trim(), updatedAt: nowISO() });
  }

  async deleteTemplate(id: ID) {
    const now = nowISO();
    await this.db.templates.update(id, { deletedAt: now, updatedAt: now });
  }

  async resetProgramme() {
    const now = nowISO();
    await this.db.transaction('rw', this.db.templates, async () => {
      const all = await this.db.templates.toArray();
      for (const t of all) await this.db.templates.put({ ...t, deletedAt: now, updatedAt: now });
      await this.db.templates.bulkPut(defaultProgramme(now));
    });
  }

  async listSessions() {
    const rows = alive(await this.db.sessions.toArray());
    return rows.sort((a, b) => (a.date === b.date ? b.startedAt.localeCompare(a.startedAt) : b.date.localeCompare(a.date)));
  }

  async getSession(id: ID) {
    const s = await this.db.sessions.get(id);
    return s && !s.deletedAt ? s : undefined;
  }

  async activeSession() {
    const rows = await this.db.sessions.where('status').equals('in_progress').toArray();
    return alive(rows).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  }

  async saveSession(s: WorkoutSession) {
    assertValid(validateSession(s));
    await this.db.sessions.put({ ...s, updatedAt: nowISO() });
  }

  async editCompletedSession(next: WorkoutSession): Promise<WorkoutSession> {
    assertValid(validateSession(next));
    const now = nowISO();
    return this.db.transaction('rw', this.db.sessions, this.db.sessionRevisions, async () => {
      const current = await this.db.sessions.get(next.id);
      if (!current || current.deletedAt) throw new Error('That workout no longer exists.');
      await this.db.sessionRevisions.add({ id: newId(), sessionId: current.id, revision: current.revision ?? 0, savedAt: now, snapshot: current });
      const saved: WorkoutSession = { ...next, revision: (current.revision ?? 0) + 1, updatedAt: now, createdAt: current.createdAt };
      await this.db.sessions.put(saved);
      return saved;
    });
  }

  async deleteSession(id: ID) {
    const now = nowISO();
    await this.db.sessions.update(id, { deletedAt: now, updatedAt: now });
  }

  async listRevisions(sessionId: ID) {
    const rows = await this.db.sessionRevisions.where('sessionId').equals(sessionId).toArray();
    return rows.sort((a, b) => b.revision - a.revision);
  }

  async restoreRevision(revisionId: ID) {
    const rev = await this.db.sessionRevisions.get(revisionId);
    if (!rev) throw new Error('Revision not found.');
    return this.editCompletedSession({ ...rev.snapshot, deletedAt: null });
  }

  async listRecovery() {
    const rows = alive(await this.db.recovery.toArray());
    return rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }

  async saveRecovery(r: RecoveryCheck) {
    await this.db.recovery.put({ ...r, updatedAt: nowISO() });
  }

  async listBody() {
    const rows = alive(await this.db.body.toArray());
    return rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }

  async saveBody(b: BodyMeasurement) {
    assertValid(validateBody(b));
    await this.db.body.put({ ...b, updatedAt: nowISO() });
  }

  async deleteBody(id: ID) {
    const now = nowISO();
    await this.db.body.update(id, { deletedAt: now, updatedAt: now });
  }

  async getMeta<T>(key: string) {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta<T>(key: string, value: T) {
    await this.db.meta.put({ key, value });
  }

  async clearAll() {
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const t of this.db.tables) await t.clear();
    });
  }
}
