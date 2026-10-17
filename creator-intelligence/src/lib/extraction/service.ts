import type Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db/client';
import { ConflictError, NotFoundError, UserError } from '../errors';
import { getScreenshot, getScreenshotImage, markExtractionFailed, saveExtraction, type ScreenshotRecord } from '../repo/screenshots';
import { extractScreenshot } from './extract';

export interface ExtractionDeps {
  client: Pick<Anthropic, 'beta'>;
  model: string;
  checkRateLimit: (db: Db) => Promise<void>;
  recordUsage: (
    db: Db,
    entry: { feature: string; model: string; inputTokens?: number | null; outputTokens?: number | null; ok: boolean; error?: string | null }
  ) => Promise<void>;
}

/**
 * Runs AI extraction for an uploaded screenshot and stores the result for review.
 * On failure the screenshot is marked "failed" with the reason; no data is invented.
 */
export async function runExtraction(db: Db, screenshotId: string, deps: ExtractionDeps): Promise<ScreenshotRecord> {
  const shot = await getScreenshot(db, screenshotId);
  if (!shot) throw new NotFoundError('Screenshot');
  if (shot.status === 'confirmed') throw new ConflictError('This screenshot has already been imported.');
  const image = await getScreenshotImage(db, screenshotId);
  if (!image) throw new UserError('The image for this screenshot is no longer stored. Upload it again.', 410, 'image_gone');

  await deps.checkRateLimit(db);
  try {
    const result = await extractScreenshot(deps.client, {
      model: deps.model,
      kind: shot.kind,
      image: image.bytes,
      mime: image.mime as 'image/jpeg' | 'image/png' | 'image/webp'
    });
    await deps.recordUsage(db, { feature: 'screenshot_extraction', model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, ok: true });
    return await saveExtraction(db, screenshotId, result.extraction, result.model);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    const tokens = error as { inputTokens?: number | null; outputTokens?: number | null };
    await deps
      .recordUsage(db, { feature: 'screenshot_extraction', model: deps.model, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, ok: false, error: message })
      .catch(() => {});
    if (!(error instanceof ConflictError)) await markExtractionFailed(db, screenshotId, message);
    throw error;
  }
}
