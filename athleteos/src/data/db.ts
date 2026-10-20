import Dexie, { type Table } from 'dexie';
import type { BodyMeasurement, Exercise, MetaEntry, RecoveryCheck, SessionRevision, UserProfile, WorkoutSession, WorkoutTemplate } from '@/domain/types';

export const DB_NAME = 'athleteos';

/**
 * IndexedDB schema. Each `version()` is a migration: Dexie runs every upgrade between the stored version
 * and the latest, in order, inside one transaction. Never edit an old version — add a new one.
 *
 *   v1  initial schema
 *   v2  session revision history (historical edits) + `revision` counter on sessions
 *   v3  index sessions by [status+date] for fast "in progress" lookups; normalise recovery `pain`/`illness`
 */
export class AthleteDB extends Dexie {
  profile!: Table<UserProfile, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<WorkoutSession, string>;
  sessionRevisions!: Table<SessionRevision, string>;
  recovery!: Table<RecoveryCheck, string>;
  body!: Table<BodyMeasurement, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      exercises: 'id, name, builtinKey, updatedAt',
      templates: 'id, dayOfWeek, updatedAt',
      sessions: 'id, date, status, templateId, updatedAt',
      recovery: 'id, date, sessionId',
      body: 'id, date',
      meta: 'key'
    });
    this.version(2)
      .stores({ sessionRevisions: 'id, sessionId, [sessionId+revision]' })
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Partial<WorkoutSession>) => {
            if (typeof s.revision !== 'number') s.revision = 0;
          });
      });
    this.version(3)
      .stores({ sessions: 'id, date, status, templateId, updatedAt, [status+date]' })
      .upgrade(async (tx) => {
        await tx
          .table('recovery')
          .toCollection()
          .modify((r: Partial<RecoveryCheck>) => {
            if (!r.pain) r.pain = 'none';
            if (typeof r.illness !== 'boolean') r.illness = false;
            if (typeof r.overridden !== 'boolean') r.overridden = false;
          });
      });
  }
}

export const SCHEMA_VERSION = 3;
