import { route } from '@/lib/api';
import { deleteSnapshot } from '@/lib/repo/videos';

export const DELETE = route<{ id: string }>(async ({ db, params }) => {
  await deleteSnapshot(db, params.id);
  return { ok: true };
});
