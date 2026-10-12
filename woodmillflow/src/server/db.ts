import { migrate } from './schema';
import { seedIfEmpty } from './seed';

/**
 * Minimal database abstraction with two interchangeable PostgreSQL back ends:
 *
 *  - "postgres": a real PostgreSQL server (Supabase, Neon, Vercel Postgres, or a local server),
 *    selected when DATABASE_URL or POSTGRES_URL is set. Use this for hosted deployments.
 *  - "pglite":   PostgreSQL compiled to WebAssembly, stored on disk in .data/pglite. Used for the
 *    laptop-hosted demonstration (`npm run demo`) — data persists across restarts and every device
 *    on the network talks to the same server, so they all see the same orders.
 *
 * Both run identical SQL, so constraints, transactions and indexes behave the same way.
 */

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Database extends Queryable {
  kind: 'pglite' | 'postgres';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class DatabaseConfigError extends Error {}

export async function createPgliteDatabase(dataDir?: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  const wrap = (q: { query: typeof pg.query }): Queryable => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await q.query<T>(sql, params);
      return result.rows;
    }
  });
  return {
    kind: 'pglite',
    ...wrap(pg),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close()
  };
}

export async function createPostgresDatabase(url: string): Promise<Database> {
  const { default: postgres } = await import('postgres');
  // prepare:false keeps compatibility with transaction-mode connection poolers (Supabase, Neon).
  const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20, onnotice: () => {} });
  type Unsafe = { unsafe: (q: string, p?: never[]) => Promise<unknown[]> };
  const wrap = (s: Unsafe): Queryable => ({
    async query<T>(q: string, params: unknown[] = []) {
      const rows = await s.unsafe(q, params as never[]);
      return [...rows] as T[];
    }
  });
  return {
    kind: 'postgres',
    ...wrap(sql as unknown as Unsafe),
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as Unsafe))) as never,
    close: () => sql.end({ timeout: 5 })
  };
}

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function storageDescription(kind: Database['kind']): string {
  return kind === 'postgres'
    ? 'PostgreSQL server (shared, persistent)'
    : 'Embedded PostgreSQL on the host computer (shared with every device connected to it, persistent)';
}

type GlobalDb = { __woodmillflowDb?: Promise<Database> };
const globalDb = globalThis as unknown as GlobalDb;

async function openDatabase(): Promise<Database> {
  const url = databaseUrl();
  let db: Database;
  if (url) {
    db = await createPostgresDatabase(url);
  } else if (process.env.VERCEL) {
    // Serverless file systems are temporary and not shared between instances, so an embedded
    // database would silently lose orders. Refuse rather than pretend data is persistent.
    throw new DatabaseConfigError(
      'No database configured. Add a Postgres database (for example Neon or Supabase) and set DATABASE_URL.'
    );
  } else {
    db = await createPgliteDatabase(process.env.WOODMILLFLOW_DATA_DIR || '.data/pglite');
  }
  await migrate(db);
  await seedIfEmpty(db);
  return db;
}

/** Shared, lazily initialised connection (survives hot reloads in development). */
export function getDb(): Promise<Database> {
  if (!globalDb.__woodmillflowDb) {
    globalDb.__woodmillflowDb = openDatabase().catch((err) => {
      globalDb.__woodmillflowDb = undefined;
      throw err;
    });
  }
  return globalDb.__woodmillflowDb;
}
