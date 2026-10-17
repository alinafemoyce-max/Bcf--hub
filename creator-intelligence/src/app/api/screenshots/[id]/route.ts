import { route } from '@/lib/api';
import { deleteScreenshot } from '@/lib/repo/screenshots';

export const DELETE = route<{ id: string }>(async ({ req, db, params }) => {
  const deleteVideos = new URL(req.url).searchParams.get('deleteVideos') === '1';
  return deleteScreenshot(db, params.id, { deleteCreatedVideos: deleteVideos });
});
