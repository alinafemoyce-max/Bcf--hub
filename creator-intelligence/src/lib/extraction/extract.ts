import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { UserError } from '../errors';
import type { ScreenshotKind } from '../types';
import { extractionSchema, type Extraction } from './schema';

const SYSTEM_PROMPT = `You transcribe TikTok analytics screenshots into structured data for a creator's personal analytics app.

Rules — accuracy matters more than completeness:
- Transcribe only what is visibly printed in the image. Never estimate, infer, calculate or fill in a value. If something is not visible or not legible, use null.
- Copy numbers exactly as displayed, including abbreviations and punctuation ("12.3K", "1,204", "1.2M", "48.5%", "8.2s"). Do not convert them.
- Copy dates exactly as displayed ("3d ago", "Oct 12", "12/10/2025", "10-12"). Do not convert them.
- Titles: copy the visible caption/title text exactly. If it ends with "..." or "…" or is visibly cut off, keep the visible text (without the ellipsis) and set title_truncated to true. Never complete a truncated title.
- List screens (for example TikTok Studio "Posts"/"Content", or a profile grid): return one entry per distinct video, top to bottom, left to right. Include rows that are cut off by the screen edge only if at least one field is legible, and set partially_visible to true.
- Thumbnail boxes are approximate fractions (0-1) of the full image width and height. Use null if unsure.
- Single-video analytics screens: return exactly one entry in "videos" with the post's headline metrics, and put watch time, full-watch rate, new followers, traffic sources and any printed retention text in "video_detail".
- Account overview screens: put follower count and period totals in "account"; "videos" may be empty.
- Do not report the phone status-bar clock as a date. observed_date_text is only for an on-screen date saying when the data is from.
- If the image is not a TikTok screen, set is_tiktok_screen to false and leave the lists empty.
- Put anything unusual or uncertain in "warnings" (for example "Views on row 4 partly hidden by a banner").`;

const KIND_HINTS: Record<ScreenshotKind, string> = {
  video_list:
    'The user says this is a list of their published videos (e.g. TikTok Studio post list or profile grid). Extract every video entry that is visible.',
  video_analytics:
    'The user says this is the analytics screen for ONE video (TikTok Studio post analytics: overview, viewers or engagement tab). Extract that one video and its detailed metrics.',
  account_overview:
    'The user says this is an account-level analytics overview (followers and totals for a period). Extract the account figures.'
};

export interface ExtractResult {
  extraction: Extraction;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Thrown when the AI call failed; the message is safe to show. Never replaced with invented data. */
export class ExtractionError extends UserError {
  constructor(message: string, status = 502, code = 'extraction_failed') {
    super(message, status, code);
  }
}

/** Sends one screenshot to Claude and returns the validated transcription. */
export async function extractScreenshot(
  client: Pick<Anthropic, 'beta'>,
  args: { model: string; kind: ScreenshotKind; image: Uint8Array; mime: 'image/jpeg' | 'image/png' | 'image/webp' }
): Promise<ExtractResult> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: args.model,
      max_tokens: 16000,
      // On a safety decline, let the API retry on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(extractionSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: args.mime, data: Buffer.from(args.image).toString('base64') } },
            { type: 'text', text: `${KIND_HINTS[args.kind]}\nReturn the transcription.` }
          ]
        }
      ]
    });
  } catch (error) {
    throw toExtractionError(error);
  }
  const usage = { inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null };
  if (response.stop_reason === 'refusal') {
    throw Object.assign(new ExtractionError('The AI declined to read this image. Enter the numbers manually instead.'), usage);
  }
  if (response.stop_reason === 'max_tokens') {
    throw Object.assign(new ExtractionError('The screenshot contained more than the AI could transcribe in one go. Try cropping it into two screenshots.'), usage);
  }
  const parsed = extractionSchema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw Object.assign(new ExtractionError('The AI returned data in an unexpected format, so nothing was saved. Try again or enter the numbers manually.'), usage);
  }
  return { extraction: sanitiseExtraction(parsed.data), model: response.model ?? args.model, ...usage };
}

/** Clamps thumbnail boxes to the image and trims strings; never adds data. */
export function sanitiseExtraction(e: Extraction): Extraction {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  return {
    ...e,
    videos: e.videos.map((v) => {
      let box = v.thumbnail_box;
      if (box) {
        const x = clamp(box.x);
        const y = clamp(box.y);
        box = { x, y, width: Math.min(clamp(box.width), 1 - x), height: Math.min(clamp(box.height), 1 - y) };
        if (box.width < 0.02 || box.height < 0.01) box = null;
      }
      const t = (s: string | null) => (s == null ? null : s.trim() || null);
      return {
        ...v,
        title_text: t(v.title_text)?.replace(/\s*(\.\.\.|…)\s*$/u, '') ?? null,
        published_text: t(v.published_text),
        views_text: t(v.views_text),
        likes_text: t(v.likes_text),
        comments_text: t(v.comments_text),
        shares_text: t(v.shares_text),
        saves_text: t(v.saves_text),
        duration_text: t(v.duration_text),
        tiktok_url_or_id: t(v.tiktok_url_or_id),
        thumbnail_box: box
      };
    })
  };
}

function toExtractionError(error: unknown): UserError {
  if (error instanceof UserError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ExtractionError('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in your environment variables.', 502, 'ai_auth');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ExtractionError('Anthropic’s rate limit was reached. Wait a minute and try again.', 429, 'ai_rate_limited');
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ExtractionError(`The AI request was rejected: ${error.message.slice(0, 200)}`, 502, 'ai_bad_request');
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ExtractionError('The AI took too long to respond. Try again.', 504, 'ai_timeout');
  }
  if (error instanceof Anthropic.APIError) {
    return new ExtractionError(`The AI service returned an error (${error.status ?? 'network'}). Try again shortly.`, 502, 'ai_error');
  }
  return new ExtractionError('Could not reach the AI service. Check your connection and try again.', 502, 'ai_error');
}
