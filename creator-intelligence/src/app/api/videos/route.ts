import { readJson, route } from '@/lib/api';
import { createVideo } from '@/lib/repo/videos';
import { videoInputSchema } from '@/lib/validation';

export const POST = route(async ({ req, db }) => {
  const input = await readJson(req, videoInputSchema);
  return { video: await createVideo(db, input) };
});
