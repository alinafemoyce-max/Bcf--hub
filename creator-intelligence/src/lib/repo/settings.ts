import type { Db } from '../db/client';

export interface AppSettings {
  /** Keep screenshot images after import (default: delete them once the data is confirmed). */
  keepScreenshots: boolean;
}

const DEFAULTS: AppSettings = { keepScreenshots: false };

export async function getSettings(db: Db): Promise<AppSettings> {
  const rows = await db.query<{ key: string; value: unknown }>('select key, value from app_settings');
  const out = { ...DEFAULTS };
  for (const r of rows) {
    const value = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    if (r.key === 'keepScreenshots' && typeof value === 'boolean') out.keepScreenshots = value;
  }
  return out;
}

export async function updateSettings(db: Db, patch: Partial<AppSettings>): Promise<AppSettings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS) || value === undefined) continue;
    await db.query(
      `insert into app_settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }
  return getSettings(db);
}

/** Full JSON export of the user's data (screenshot image bytes are excluded). */
export async function exportAll(db: Db) {
  const q = (sql: string) => db.query(sql);
  return {
    app: 'AJM Creator Intelligence',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    videos: await q('select * from videos order by published_at nulls last'),
    videoSnapshots: await q('select * from video_snapshots order by captured_at'),
    accountSnapshots: await q('select * from account_snapshots order by captured_at'),
    screenshots: await q(
      `select id, sha256, kind, original_filename, mime_type, width, height, byte_size, status, extraction, extraction_model,
              observed_at, observed_at_source, uploaded_at, confirmed_at, result_summary from screenshots order by uploaded_at`
    ),
    ideas: await q('select * from ideas order by created_at'),
    settings: await q('select key, value from app_settings')
  };
}

/** Permanently deletes every record (used by "Delete all data" in Settings). */
export async function deleteAllData(db: Db) {
  await db.transaction(async (tx) => {
    for (const table of ['ideas', 'video_snapshots', 'account_snapshots', 'screenshots', 'videos', 'ai_usage']) {
      await tx.query(`delete from ${table}`);
    }
  });
}
