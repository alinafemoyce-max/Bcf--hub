import { readJson, route } from '@/lib/api';
import { addAccountSnapshot } from '@/lib/repo/account';
import { accountSnapshotInputSchema } from '@/lib/validation';

export const POST = route(async ({ req, db }) => {
  const input = await readJson(req, accountSnapshotInputSchema);
  return { snapshot: await addAccountSnapshot(db, input, { source: 'manual' }) };
});
