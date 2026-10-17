import { readJson, route } from '@/lib/api';
import { confirmScreenshot } from '@/lib/repo/screenshots';
import { getSettings } from '@/lib/repo/settings';
import { confirmPayloadSchema } from '@/lib/validation';

export const POST = route<{ id: string }>(async ({ req, db, params }) => {
  const payload = await readJson(req, confirmPayloadSchema);
  const settings = await getSettings(db);
  const summary = await confirmScreenshot(db, params.id, payload, { keepImage: settings.keepScreenshots });
  return { summary };
});
