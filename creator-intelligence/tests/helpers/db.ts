import { createPgliteDb, createPostgresDb, type Db } from '../../src/lib/db/client';
import { migrate } from '../../src/lib/db/migrate';

/**
 * Fresh, migrated database for a test file. Uses in-memory PGlite by default, or a real Postgres
 * server when TEST_DATABASE_URL is set (each call gets its own schema so files can run in parallel).
 */
export async function testDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const db = await createPgliteDb();
    await migrate(db);
    return db;
  }
  const schema = `t_${Math.random().toString(36).slice(2, 10)}`;
  const admin = createPostgresDb(url);
  await admin.query(`create schema ${schema}`);
  await admin.close();
  const sep = url.includes('?') ? '&' : '?';
  const db = createPostgresDb(`${url}${sep}options=${encodeURIComponent(`-c search_path=${schema}`)}`);
  await migrate(db);
  return db;
}
