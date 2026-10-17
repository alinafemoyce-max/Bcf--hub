import { route } from '@/lib/api';
import { UserError } from '@/lib/errors';
import { createScreenshot, MAX_IMAGE_BYTES } from '@/lib/repo/screenshots';
import type { ObservedSource, ScreenshotKind } from '@/lib/types';

const KINDS: ScreenshotKind[] = ['video_list', 'video_analytics', 'account_overview'];
const SOURCES: ObservedSource[] = ['file_metadata', 'visible_on_screen', 'user', 'upload_time'];

/** Upload one screenshot (multipart/form-data). Duplicate files are detected by hash. */
export const POST = route(async ({ req, db }) => {
  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) throw new UserError('The image is larger than 4 MB.', 413);
  const form = await req.formData().catch(() => {
    throw new UserError('Upload a screenshot as form data.');
  });
  const file = form.get('file');
  if (!(file instanceof File)) throw new UserError('No file received.');
  const kind = String(form.get('kind') ?? '') as ScreenshotKind;
  if (!KINDS.includes(kind)) throw new UserError('Choose what kind of screenshot this is.');
  const observedRaw = form.get('observedAt');
  const observedAt = observedRaw && !Number.isNaN(Date.parse(String(observedRaw))) ? new Date(String(observedRaw)).toISOString() : null;
  const sourceRaw = String(form.get('observedAtSource') ?? '') as ObservedSource;
  const int = (k: string) => {
    const n = Number(form.get(k));
    return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
  };
  const target = form.get('targetVideoId');
  const { screenshot, duplicate } = await createScreenshot(db, {
    originalSha256: String(form.get('originalSha256') ?? '') || null,
    kind,
    filename: file.name || null,
    bytes: new Uint8Array(await file.arrayBuffer()),
    width: int('width'),
    height: int('height'),
    observedAt: observedAt ?? new Date().toISOString(),
    observedAtSource: observedAt && SOURCES.includes(sourceRaw) ? sourceRaw : 'upload_time',
    targetVideoId: target ? String(target) : null
  });
  return { screenshot: { ...screenshot, extraction: undefined }, duplicate };
});
