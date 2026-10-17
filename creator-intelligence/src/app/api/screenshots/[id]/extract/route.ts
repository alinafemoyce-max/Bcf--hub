import { aiModel, checkAiRateLimit, getAnthropic, recordAiUsage } from '@/lib/ai/config';
import { route } from '@/lib/api';
import { runExtraction } from '@/lib/extraction/service';

// Vision extraction can take a while; allow up to five minutes (Vercel Hobby maximum with Fluid compute).
export const maxDuration = 300;

export const POST = route<{ id: string }>(async ({ db, params }) => {
  const client = getAnthropic();
  const screenshot = await runExtraction(db, params.id, { client, model: aiModel(), checkRateLimit: checkAiRateLimit, recordUsage: recordAiUsage });
  return { screenshot: { id: screenshot.id, status: screenshot.status, entries: screenshot.extraction?.videos.length ?? 0 } };
});
