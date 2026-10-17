import { readJson, route } from '@/lib/api';
import { deleteIdea, updateIdea } from '@/lib/repo/ideas';
import type { IdeaStatus } from '@/lib/types';
import { ideaPatchSchema } from '@/lib/validation';

export const PATCH = route<{ id: string }>(async ({ req, db, params }) => {
  const patch = await readJson(req, ideaPatchSchema);
  return { idea: await updateIdea(db, params.id, { ...patch, status: patch.status as IdeaStatus | undefined }) };
});

export const DELETE = route<{ id: string }>(async ({ db, params }) => {
  await deleteIdea(db, params.id);
  return { ok: true };
});
