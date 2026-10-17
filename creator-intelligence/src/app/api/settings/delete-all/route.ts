import { z } from 'zod';
import { readJson, route } from '@/lib/api';
import { deleteAllData } from '@/lib/repo/settings';

export const POST = route(async ({ req, db }) => {
  await readJson(req, z.object({ confirm: z.literal('DELETE') }));
  await deleteAllData(db);
  return { ok: true };
});
