import type { BodyMeasurement, Exercise, RecoveryCheck, SessionRevision, UserProfile, WorkoutSession, WorkoutTemplate, Units } from '@/domain/types';
import { validateSession } from '@/domain/validation';
import { kgToDisplay, formatNumber } from '@/lib/units';
import { nowISO } from '@/lib/id';
import type { AthleteDB } from './db';
import { SCHEMA_VERSION } from './db';

export const BACKUP_FORMAT = 2;

export interface BackupData {
  profile: UserProfile[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  sessionRevisions: SessionRevision[];
  recovery: RecoveryCheck[];
  body: BodyMeasurement[];
}

export interface BackupFile {
  app: 'AthleteOS';
  format: number;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

const TABLES = ['profile', 'exercises', 'templates', 'sessions', 'sessionRevisions', 'recovery', 'body'] as const;

export async function exportBackup(db: AthleteDB): Promise<BackupFile> {
  const data = {} as BackupData;
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) (data as unknown as Record<string, unknown[]>)[t] = await db.table(t).toArray();
  });
  return { app: 'AthleteOS', format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(), data };
}

export class BackupError extends Error {}

/** Parses and validates a backup, upgrading older backup formats. Throws BackupError with a readable message. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('This file isn’t valid JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new BackupError('This file isn’t an AthleteOS backup.');
  const f = raw as Partial<BackupFile> & { data?: Partial<BackupData> };
  if (f.app !== 'AthleteOS' || !f.data || typeof f.data !== 'object') throw new BackupError('This file isn’t an AthleteOS backup.');
  if (typeof f.format !== 'number' || f.format > BACKUP_FORMAT) throw new BackupError('This backup was made by a newer version of AthleteOS. Update the app and try again.');

  const data = {} as BackupData;
  for (const t of TABLES) {
    const rows = (f.data as unknown as Record<string, unknown>)[t];
    if (rows == null) {
      (data as unknown as Record<string, unknown[]>)[t] = [];
      continue;
    }
    if (!Array.isArray(rows)) throw new BackupError(`Backup section “${t}” is damaged.`);
    for (const r of rows) {
      if (!r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string') throw new BackupError(`Backup section “${t}” contains an invalid record.`);
    }
    (data as unknown as Record<string, unknown[]>)[t] = rows;
  }

  // Format 1 backups pre-date session revisions.
  if (f.format < 2) data.sessions = data.sessions.map((s) => ({ ...s, revision: typeof s.revision === 'number' ? s.revision : 0 }));

  data.sessions.forEach((s, i) => {
    const issues = validateSession(s);
    if (issues.length) throw new BackupError(`Workout ${i + 1} (${s.date ?? 'unknown date'}) is invalid: ${issues[0]}`);
  });
  data.recovery = data.recovery.map((r) => ({ ...r, pain: r.pain ?? 'none', illness: !!r.illness, overridden: !!r.overridden }));
  return { app: 'AthleteOS', format: BACKUP_FORMAT, schemaVersion: f.schemaVersion ?? SCHEMA_VERSION, exportedAt: f.exportedAt ?? nowISO(), data };
}

export type ImportMode = 'replace' | 'merge';

/**
 * replace: wipe local data and load the backup.
 * merge:   keep whichever copy of each record was updated most recently (the same rule a cloud sync would use).
 */
export async function importBackup(db: AthleteDB, file: BackupFile, mode: ImportMode): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.meta], async () => {
    for (const t of TABLES) {
      const table = db.table(t);
      const rows = (file.data as unknown as Record<string, { id: string; updatedAt?: string; savedAt?: string }[]>)[t];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut(rows);
        added += rows.length;
        continue;
      }
      for (const row of rows) {
        const cur = (await table.get(row.id)) as { updatedAt?: string; savedAt?: string } | undefined;
        if (!cur) {
          await table.put(row);
          added++;
        } else if ((row.updatedAt ?? row.savedAt ?? '') > (cur.updatedAt ?? cur.savedAt ?? '')) {
          await table.put(row);
          updated++;
        }
      }
    }
    await db.meta.put({ key: 'programmeSeeded', value: nowISO() });
  });
  return { added, updated };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

const csvCell = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  // Prevent spreadsheet formula injection from free-text notes.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One row per logged set across all completed workouts, in the user's units. */
export function sessionsToCSV(sessions: WorkoutSession[], exercises: Map<string, Exercise>, units: Units): string {
  const header = [
    'date',
    'workout',
    'status',
    'exercise',
    'set',
    'completed',
    `weight_${units}`,
    'load_mode',
    'reps',
    'per_side',
    'rir',
    'technique',
    'duration_s',
    'distance_m',
    'time_s',
    'rest_s',
    'range_of_motion_1_5',
    'control_1_5',
    'exercise_notes',
    'session_notes'
  ];
  const rows: string[] = [header.join(',')];
  const ordered = sessions.filter((s) => !s.deletedAt).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
  for (const s of ordered) {
    for (const se of s.exercises) {
      const ex = exercises.get(se.exerciseId);
      se.sets.forEach((set, i) => {
        rows.push(
          [
            s.date,
            s.name,
            s.status,
            ex?.name ?? se.exerciseId,
            i + 1,
            set.completed ? 'yes' : 'no',
            set.weightKg != null ? formatNumber(kgToDisplay(set.weightKg, units), 2) : '',
            se.loadMode,
            set.reps,
            se.prescription.perSide ? 'yes' : '',
            set.rir,
            set.technique,
            set.durationSec,
            set.distanceM,
            set.timeSec,
            set.restSec,
            set.rom,
            set.control,
            i === 0 ? se.notes : '',
            i === 0 && se === s.exercises[0] ? s.notes : ''
          ]
            .map(csvCell)
            .join(',')
        );
      });
    }
  }
  return rows.join('\n') + '\n';
}
