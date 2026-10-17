import { readJson, route } from '@/lib/api';
import { deleteVideo, updateVideo } from '@/lib/repo/videos';
import { videoPatchSchema } from '@/lib/validation';

export const PATCH = route<{ id: string }>(async ({ req, db, params }) => {
  const patch = await readJson(req, videoPatchSchema);
  return { video: await updateVideo(db, params.id, patch) };
});

export const DELETE = route<{ id: string }>(async ({ db, params }) => {
  await deleteVideo(db, params.id);
  return { ok: true };
});
