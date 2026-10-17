import { readJson, route } from '@/lib/api';
import { createIdea } from '@/lib/repo/ideas';
import type { IdeaStatus } from '@/lib/types';
import { ideaInputSchema } from '@/lib/validation';

export const POST = route(async ({ req, db }) => {
  const input = await readJson(req, ideaInputSchema);
  return { idea: await createIdea(db, { ...input, status: input.status as IdeaStatus | undefined }) };
});
