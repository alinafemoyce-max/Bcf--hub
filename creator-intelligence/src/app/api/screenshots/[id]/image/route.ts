import { route } from '@/lib/api';
import { NotFoundError } from '@/lib/errors';
import { getScreenshotImage } from '@/lib/repo/screenshots';

export const GET = route<{ id: string }>(async ({ db, params }) => {
  const image = await getScreenshotImage(db, params.id);
  if (!image) throw new NotFoundError('Image');
  return new Response(Buffer.from(image.bytes), {
    headers: { 'Content-Type': image.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  });
});
