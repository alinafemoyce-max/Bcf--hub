import postgres from 'postgres';

export type Row = Record<string, unknown>;

/**
 * Minimal database interface shared by the production driver (postgres.js) and the embedded
 * PGlite database used for local development and tests. All SQL uses $1-style parameters.
 * JSON values must be passed as JSON.stringify(...) strings and cast with ::jsonb in SQL.
 */
export interface Db {
  readonly kind: 'postgres' | 'pglite';
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// int8 (20) and numeric (1700) are returned as JS numbers. Counts here are far below 2^53.
const toNumber = (value: string) => (value === null ? null : Number(value));

export function createPostgresDb(url: string): Db {
  const sql = postgres(url, {
    // prepare: false keeps transaction-mode connection poolers (Supabase, Neon pooler) working.
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: toNumber },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: toNumber }
    }
  });
  type Runner = { unsafe: (text: string, params?: never[]) => Promise<unknown> };
  const wrap = (runner: Runner, isRoot: boolean): Db => ({
    kind: 'postgres',
    async query<T>(text: string, params: unknown[] = []) {
      const rows = (await runner.unsafe(text, params.map(normaliseParam) as never[])) as unknown as T[];
      return Array.from(rows);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!isRoot) return fn(wrap(runner, false));
      return (await sql.begin((tx) => fn(wrap(tx as unknown as Runner, false)))) as T;
    },
    async close() {
      if (isRoot) await sql.end({ timeout: 5 });
    }
  });
  return wrap(sql as unknown as Runner, true);
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) {
    const fs = await import('node:fs');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const pg = new PGlite(dataDir, { parsers: { 20: toNumber, 1700: toNumber } });
  await pg.waitReady;
  type Q = { query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> };
  const wrap = (runner: Q, isRoot: boolean): Db => ({
    kind: 'pglite',
    async query<T>(text: string, params: unknown[] = []) {
      const result = await runner.query<T>(text, params.map(normaliseParam));
      return result.rows;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!isRoot) return fn(wrap(runner, false));
      return pg.transaction((tx) => fn(wrap(tx as unknown as Q, false)));
    },
    async close() {
      if (isRoot) await pg.close();
    }
  });
  return wrap(pg as unknown as Q, true);
}

function normaliseParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}
