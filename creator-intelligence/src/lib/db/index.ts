import 'server-only';
import { createPgliteDb, createPostgresDb, type Db } from './client';
import { migrate } from './migrate';

export type { Db, Row } from './client';

// One database client per server process (survives dev hot reloads via globalThis).
const globalForDb = globalThis as unknown as { __ajmDb?: Promise<Db> };

/**
 * Returns the app database, running any pending migrations on first use.
 * - DATABASE_URL set: connects to that Postgres (Neon, Supabase, or any Postgres 13+).
 * - Not set (local development only): an embedded PGlite database stored in ./.data.
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__ajmDb) {
    globalForDb.__ajmDb = open().catch((error) => {
      globalForDb.__ajmDb = undefined;
      throw error;
    });
  }
  return globalForDb.__ajmDb;
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  let db: Db;
  if (url) {
    db = createPostgresDb(url);
  } else if (process.env.VERCEL || process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_DB) {
    throw new DatabaseNotConfiguredError();
  } else {
    db = await createPgliteDb(process.env.LOCAL_DB_DIR || './.data/pglite');
  }
  await migrate(db);
  return db;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not set. Add a Postgres connection string to the environment variables.');
    this.name = 'DatabaseNotConfiguredError';
  }
}
