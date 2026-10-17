import 'server-only';
import type { Db } from './db';
import { listAccountSnapshots } from './repo/account';
import { listSnapshots, listVideos } from './repo/videos';

/** Loads everything the dashboard/library needs. Personal-scale data, so one pass is fine. */
export async function loadLibrary(db: Db) {
  const [videos, snapshots, accountSnapshots] = await Promise.all([listVideos(db), listSnapshots(db), listAccountSnapshots(db)]);
  return { videos, snapshots, accountSnapshots };
}
