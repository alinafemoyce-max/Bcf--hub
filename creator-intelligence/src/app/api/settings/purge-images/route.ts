import { route } from '@/lib/api';
import { purgeAllImages } from '@/lib/repo/screenshots';

export const POST = route(async ({ db }) => ({ purged: await purgeAllImages(db) }));
