import { z } from 'zod';
import { readJson, route } from '@/lib/api';
import { updateSettings } from '@/lib/repo/settings';

export const PATCH = route(async ({ req, db }) => {
  const patch = await readJson(req, z.object({ keepScreenshots: z.boolean().optional() }));
  return { settings: await updateSettings(db, patch) };
});
