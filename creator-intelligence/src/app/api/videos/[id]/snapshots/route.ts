import { readJson, route } from '@/lib/api';
import { addSnapshot } from '@/lib/repo/videos';
import { snapshotInputSchema } from '@/lib/validation';

export const POST = route<{ id: string }>(async ({ req, db, params }) => {
  const input = await readJson(req, snapshotInputSchema);
  const result = await addSnapshot(db, params.id, { ...input, source: 'manual' });
  return result;
});
