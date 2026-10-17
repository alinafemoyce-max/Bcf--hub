import type { Db } from './client';
import { migrations } from './migrations';

const MIGRATION_LOCK = 727274; // arbitrary constant shared by every app instance

/** Applies pending migrations. Safe to call concurrently from several serverless instances. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    'create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())'
  );
  const applied: string[] = [];
  await db.transaction(async (tx) => {
    await tx.query('select pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
    const done = new Set((await tx.query<{ id: string }>('select id from schema_migrations')).map((r) => r.id));
    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      await execMulti(tx, migration.sql);
      await tx.query('insert into schema_migrations (id) values ($1)', [migration.id]);
      applied.push(migration.id);
    }
  });
  return applied;
}

/** Runs a multi-statement SQL script one statement at a time (extended protocol allows one per call). */
async function execMulti(db: Db, script: string) {
  const statements = script
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  for (const statement of statements) await db.query(statement);
}
