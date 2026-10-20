import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { AthleteDB } from '@/data/db';
import { DexieRepository, defaultProfile } from '@/data/repository';
import { exportBackup, importBackup, parseBackup, sessionsToCSV, BackupError } from '@/data/backup';
import { createSession, finishSession } from '@/domain/session';
import { computePersonalRecords, sessionVolume } from '@/domain/analytics';
import { exerciseHistory, recommend } from '@/domain/overload';
import { ValidationError } from '@/domain/validation';
import { exerciseMap, lifts, session, INC } from './helpers';

let counter = 0;
const opened: AthleteDB[] = [];
function freshName() {
  return `athleteos-test-${Date.now()}-${++counter}`;
}
async function openRepo(name: string) {
  const db = new AthleteDB(name);
  opened.push(db);
  const repo = new DexieRepository(db);
  await repo.init();
  return repo;
}
afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close();
    await Dexie.delete(db.name);
  }
});

const P = { sets: 3, repsMin: 10, repsMax: 12 };

describe('first run', () => {
  it('seeds the exercise library and the Monday–Friday programme once', async () => {
    const name = freshName();
    const repo = await openRepo(name);
    const templates = await repo.listTemplates();
    expect(templates.map((t) => [t.dayOfWeek, t.name])).toEqual([
      [1, 'Full Body'],
      [2, 'Mobility'],
      [3, 'Upper Body'],
      [4, 'Lower Body'],
      [5, 'Speed & Agility']
    ]);
    expect(templates[0].exercises).toHaveLength(7);
    expect(templates[3].exercises).toHaveLength(8);
    // Calling init again (every app start) must not duplicate anything.
    await repo.init();
    expect(await repo.listTemplates()).toHaveLength(5);
    const exercises = await repo.listExercises();
    expect(exercises.find((e) => e.name === 'Lat pulldown')).toBeTruthy();
  });

  it('does not re-create the programme after the user deletes a workout', async () => {
    const repo = await openRepo(freshName());
    await repo.deleteTemplate('tpl_tue');
    await repo.init();
    expect((await repo.listTemplates()).map((t) => t.id)).not.toContain('tpl_tue');
  });
});

describe('persistence after reload', () => {
  it('keeps profile, sessions, body weight and recovery checks after the database is closed and reopened', async () => {
    const name = freshName();
    const repo = await openRepo(name);
    await repo.saveProfile({ ...defaultProfile(), bodyWeightKg: 70 });
    const s = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 11, 10]), P);
    await repo.saveSession(s);
    await repo.saveBody({ id: 'b1', createdAt: 'x', updatedAt: 'x', date: '2026-10-12', weightKg: 70.4 });
    await repo.saveRecovery({ id: 'r1', createdAt: 'x', updatedAt: 'x', date: '2026-10-12', sleepHours: 8, energy: 4, soreness: 2, motivation: 4, pain: 'none', illness: false, overridden: false });
    repo.db.close();

    const again = await openRepo(name);
    expect((await again.getProfile())?.bodyWeightKg).toBe(70);
    const sessions = await again.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].exercises[0].sets.map((x) => x.reps)).toEqual([12, 11, 10]);
    expect((await again.listBody())[0].weightKg).toBe(70.4);
    expect((await again.listRecovery())[0].sleepHours).toBe(8);
  });

  it('an unfinished workout is saved set by set and can be resumed after reload', async () => {
    const name = freshName();
    const repo = await openRepo(name);
    const profile = { ...defaultProfile(), increments: INC };
    const templates = await repo.listTemplates();
    const exercises = new Map((await repo.listExercises()).map((e) => [e.id, e]));
    let live = createSession({ template: templates[0], date: '2026-10-19', now: '2026-10-19T17:00:00Z', exercises, sessions: [], profile });
    await repo.saveSession(live);
    // Log one set, then "close the app".
    live = structuredClone(live);
    live.exercises[1].sets[0] = { ...live.exercises[1].sets[0], weightKg: 16, reps: 10, completed: true };
    await repo.saveSession(live);
    repo.db.close();

    const again = await openRepo(name);
    const resumed = await again.activeSession();
    expect(resumed?.id).toBe(live.id);
    expect(resumed?.status).toBe('in_progress');
    expect(resumed?.exercises[1].sets[0]).toMatchObject({ weightKg: 16, reps: 10, completed: true });
    // In-progress sessions never feed the overload engine.
    expect(exerciseHistory([resumed!], resumed!.exercises[1].exerciseId)).toEqual([]);

    await again.saveSession(finishSession(resumed!, '2026-10-19T18:00:00Z'));
    expect(await again.activeSession()).toBeUndefined();
    expect(exerciseHistory(await again.listSessions(), resumed!.exercises[1].exerciseId)).toHaveLength(1);
  });

  it('rejects invalid data instead of storing it', async () => {
    const repo = await openRepo(freshName());
    const bad = session('2026-10-12', 'bi_lat_pulldown', lifts(-5, [12]), P);
    await expect(repo.saveSession(bad)).rejects.toBeInstanceOf(ValidationError);
    expect(await repo.listSessions()).toHaveLength(0);
  });
});

describe('database migrations', () => {
  it('upgrades a version 1 database (adds revision tracking and normalises recovery records)', async () => {
    const name = freshName();
    const v1 = new Dexie(name);
    v1.version(1).stores({
      profile: 'id',
      exercises: 'id, name, builtinKey, updatedAt',
      templates: 'id, dayOfWeek, updatedAt',
      sessions: 'id, date, status, templateId, updatedAt',
      recovery: 'id, date, sessionId',
      body: 'id, date',
      meta: 'key'
    });
    const legacy = session('2026-09-01', 'bi_lat_pulldown', lifts(25, [12, 12, 12]), P) as Partial<ReturnType<typeof session>>;
    delete legacy.revision;
    await v1.table('sessions').add(legacy);
    await v1.table('recovery').add({ id: 'r-old', date: '2026-09-01', createdAt: 'x', updatedAt: 'x', sleepHours: 7 });
    v1.close();

    const repo = await openRepo(name);
    expect(repo.db.verno).toBe(3);
    const [s] = await repo.listSessions();
    expect(s.revision).toBe(0);
    const [r] = await repo.listRecovery();
    expect(r).toMatchObject({ pain: 'none', illness: false, overridden: false, sleepHours: 7 });
    // Built-in library is added to an old database without touching existing rows.
    expect((await repo.listExercises()).length).toBeGreaterThan(30);
  });
});

describe('editing historical workouts', () => {
  it('keeps a revision snapshot, updates PRs and recommendations, and leaves other sessions untouched', async () => {
    const repo = await openRepo(freshName());
    const exercises = exerciseMap();
    const older = session('2026-10-05', 'bi_lat_pulldown', lifts(30, [12, 11, 10]), P);
    const newer = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);
    await repo.saveSession(older);
    await repo.saveSession(newer);

    const before = await repo.listSessions();
    const exercise = exercises.get('bi_lat_pulldown')!;
    const recBefore = recommend({ exercise, prescription: P, loadMode: 'total', history: exerciseHistory(before, exercise.id), increments: INC, units: 'kg' });
    expect(recBefore.action).toBe('increase_load');

    // Correct a typo: the last set of the newer session was actually 9 reps.
    const edited = structuredClone(newer);
    edited.exercises[0].sets[2].reps = 9;
    edited.notes = 'Corrected last set';
    const saved = await repo.editCompletedSession(edited);
    expect(saved.revision).toBe(1);

    const revisions = await repo.listRevisions(newer.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].snapshot.exercises[0].sets[2].reps).toBe(12);

    const after = await repo.listSessions();
    expect(after).toHaveLength(2);
    expect((await repo.getSession(older.id))!.exercises[0].sets.map((s) => s.reps)).toEqual([12, 11, 10]);
    const recAfter = recommend({ exercise, prescription: P, loadMode: 'total', history: exerciseHistory(after, exercise.id), increments: INC, units: 'kg' });
    expect(recAfter.action).toBe('maintain');

    // Restoring the revision brings the original back (and is itself recorded).
    const restored = await repo.restoreRevision(revisions[0].id);
    expect(restored.exercises[0].sets[2].reps).toBe(12);
    expect(restored.revision).toBe(2);
    expect(await repo.listRevisions(newer.id)).toHaveLength(2);
  });

  it('PRs are derived, so deleting or editing a session never leaves a stale record', async () => {
    const repo = await openRepo(freshName());
    const exercises = exerciseMap();
    await repo.saveSession(session('2026-10-05', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P));
    const typo = session('2026-10-12', 'bi_lat_pulldown', lifts(300, [12, 12, 12]), P);
    await repo.saveSession(typo);
    let prs = computePersonalRecords(await repo.listSessions(), exercises);
    expect(prs.find((p) => p.kind === 'heaviest_weight')?.value).toBe(300);

    const fixed = structuredClone(typo);
    fixed.exercises[0].sets.forEach((s) => (s.weightKg = 32.5));
    await repo.editCompletedSession(fixed);
    prs = computePersonalRecords(await repo.listSessions(), exercises);
    expect(prs.find((p) => p.kind === 'heaviest_weight')?.value).toBe(32.5);

    await repo.deleteSession(typo.id);
    prs = computePersonalRecords(await repo.listSessions(), exercises);
    expect(prs.find((p) => p.kind === 'heaviest_weight')?.value).toBe(30);
  });

  it('rejects an invalid edit and keeps the original', async () => {
    const repo = await openRepo(freshName());
    const s = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);
    await repo.saveSession(s);
    const bad = structuredClone(s);
    bad.date = '2026-13-45';
    await expect(repo.editCompletedSession(bad)).rejects.toBeInstanceOf(ValidationError);
    expect((await repo.getSession(s.id))!.date).toBe('2026-10-12');
    expect(await repo.listRevisions(s.id)).toHaveLength(0);
  });
});

describe('backup and export', () => {
  it('round-trips a JSON backup into a new database (replace)', async () => {
    const a = await openRepo(freshName());
    await a.saveProfile({ ...defaultProfile(), bodyWeightKg: 70 });
    await a.saveSession(session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P));
    const file = await exportBackup(a.db);
    const text = JSON.stringify(file);

    const b = await openRepo(freshName());
    await importBackup(b.db, parseBackup(text), 'replace');
    expect((await b.getProfile())?.bodyWeightKg).toBe(70);
    expect(await b.listSessions()).toHaveLength(1);
    expect(await b.listTemplates()).toHaveLength(5);
  });

  it('merge keeps the most recently updated copy of each record', async () => {
    const a = await openRepo(freshName());
    const s = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 12, 12]), P);
    await a.saveSession(s);
    const file = await exportBackup(a.db);
    const local = { ...(await a.getSession(s.id))!, notes: 'newer local note', updatedAt: '2999-01-01T00:00:00Z' };
    await a.db.sessions.put(local);
    await importBackup(a.db, file, 'merge');
    expect((await a.getSession(s.id))!.notes).toBe('newer local note');
  });

  it('rejects files that are not valid AthleteOS backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"Other"}')).toThrow(/isn’t an AthleteOS backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'AthleteOS', format: 99, data: {} }))).toThrow(/newer version/);
    const broken = { app: 'AthleteOS', format: 2, data: { sessions: [{ ...session('2026-10-12', 'x', lifts(30, [12]), P), date: 'yesterday' }] } };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/invalid/);
  });

  it('upgrades format-1 backups', () => {
    const s = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12]), P) as Partial<ReturnType<typeof session>>;
    delete s.revision;
    const parsed = parseBackup(JSON.stringify({ app: 'AthleteOS', format: 1, data: { sessions: [s] } }));
    expect(parsed.data.sessions[0].revision).toBe(0);
    expect(parsed.data.body).toEqual([]);
  });

  it('exports one CSV row per set, in the chosen units, safe for spreadsheets', () => {
    const s = session('2026-10-12', 'bi_lat_pulldown', lifts(30, [12, 11]), P, { notes: '=HYPERLINK("x")' });
    const csv = sessionsToCSV([s], exerciseMap(), 'lb');
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('weight_lb');
    expect(lines[1]).toContain('Lat pulldown');
    expect(lines[1]).toContain('66.14');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('volume', () => {
  it('counts both dumbbells and both sides', () => {
    const s = session('2026-10-12', 'bi_walking_lunge', lifts(10, [10, 10]), { sets: 2, repsMin: 10, repsMax: 10, perSide: true }, { loadMode: 'per_dumbbell' });
    expect(sessionVolume(s)).toBe(10 * 2 * 10 * 2 * 2);
  });
});
