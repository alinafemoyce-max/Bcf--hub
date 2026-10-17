import { route } from '@/lib/api';
import { deleteAccountSnapshot } from '@/lib/repo/account';

export const DELETE = route<{ id: string }>(async ({ db, params }) => {
  await deleteAccountSnapshot(db, params.id);
  return { ok: true };
});
