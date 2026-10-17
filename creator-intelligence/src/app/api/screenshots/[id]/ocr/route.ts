import { z } from 'zod';
import { readJson, route } from '@/lib/api';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { extractionSchema } from '@/lib/extraction/schema';
import { sanitiseExtraction } from '@/lib/extraction/extract';
import { OCR_MODEL_LABEL } from '@/lib/ocr-parse';
import { getScreenshot, saveExtraction } from '@/lib/repo/screenshots';

const ocrResultSchema = extractionSchema.extend({ ocr_lines: z.array(z.string().max(500)).max(300).optional() });

/** Saves a transcription produced by the free on-device reader (no AI call, no cost). */
export const POST = route<{ id: string }>(async ({ req, db, params }) => {
  const result = await readJson(req, ocrResultSchema);
  const shot = await getScreenshot(db, params.id);
  if (!shot) throw new NotFoundError('Screenshot');
  if (shot.status === 'confirmed') throw new ConflictError('This screenshot has already been imported.');
  const saved = await saveExtraction(db, params.id, { ...sanitiseExtraction(result), ocr_lines: result.ocr_lines }, OCR_MODEL_LABEL);
  return { screenshot: { id: saved.id, status: saved.status, entries: saved.extraction?.videos.length ?? 0 } };
});
