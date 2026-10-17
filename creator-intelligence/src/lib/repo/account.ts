import type { Db } from '../db/client';
import { NotFoundError } from '../errors';
import type { AccountSnapshot } from '../types';
import type { AccountSnapshotInput } from '../validation';
import { toAccountSnapshot } from './mappers';
import { isUuid } from './videos';

export async function addAccountSnapshot(
  db: Db,
  input: AccountSnapshotInput,
  meta: { source: AccountSnapshot['source']; screenshot_id?: string | null } = { source: 'manual' }
): Promise<AccountSnapshot> {
  const rows = await db.query(
    `insert into account_snapshots (captured_at, source, screenshot_id, followers, total_likes, period_label, period_days, period_views,
       period_profile_views, period_likes, period_comments, period_shares, period_followers_change, approximate_fields, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15) returning *`,
    [
      input.captured_at,
      meta.source,
      meta.screenshot_id ?? null,
      input.followers ?? null,
      input.total_likes ?? null,
      input.period_label ?? null,
      input.period_days ?? null,
      input.period_views ?? null,
      input.period_profile_views ?? null,
      input.period_likes ?? null,
      input.period_comments ?? null,
      input.period_shares ?? null,
      input.period_followers_change ?? null,
      JSON.stringify(input.approximate_fields ?? []),
      input.notes ?? null
    ]
  );
  return toAccountSnapshot(rows[0]);
}

export async function listAccountSnapshots(db: Db): Promise<AccountSnapshot[]> {
  const rows = await db.query('select * from account_snapshots order by captured_at asc');
  return rows.map(toAccountSnapshot);
}

export async function deleteAccountSnapshot(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) throw new NotFoundError('Account snapshot');
  const rows = await db.query('delete from account_snapshots where id = $1 returning id', [id]);
  if (!rows[0]) throw new NotFoundError('Account snapshot');
}
