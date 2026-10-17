import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db/client';
import { UserError } from '../errors';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export function aiModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!isAiConfigured()) {
    throw new UserError(
      'AI is not configured yet: add ANTHROPIC_API_KEY to the app’s environment variables. You can still enter the numbers manually.',
      503,
      'ai_not_configured'
    );
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 1, timeout: 120_000 });
  return client;
}

export const AI_LIMITS = {
  perDay: Number(process.env.AI_DAILY_LIMIT) || 150,
  perMinute: 12
};

/** Enforces simple per-minute and per-day AI request limits (shared across serverless instances). */
export async function checkAiRateLimit(db: Db) {
  const rows = await db.query<{ day: number; minute: number }>(
    `select count(*) filter (where created_at > now() - interval '1 day')::int as day,
            count(*) filter (where created_at > now() - interval '1 minute')::int as minute
       from ai_usage where created_at > now() - interval '1 day'`
  );
  const { day, minute } = rows[0] ?? { day: 0, minute: 0 };
  if (minute >= AI_LIMITS.perMinute) throw new UserError('Too many AI requests in the last minute. Wait a moment and try again.', 429, 'rate_limited');
  if (day >= AI_LIMITS.perDay) {
    throw new UserError(`Daily AI limit reached (${AI_LIMITS.perDay} requests). It resets over the next 24 hours, or raise AI_DAILY_LIMIT.`, 429, 'rate_limited');
  }
}

export async function recordAiUsage(
  db: Db,
  entry: { feature: string; model: string; inputTokens?: number | null; outputTokens?: number | null; ok: boolean; error?: string | null }
) {
  await db.query('insert into ai_usage (feature, model, input_tokens, output_tokens, ok, error) values ($1,$2,$3,$4,$5,$6)', [
    entry.feature,
    entry.model,
    entry.inputTokens ?? null,
    entry.outputTokens ?? null,
    entry.ok,
    entry.error?.slice(0, 500) ?? null
  ]);
}

export async function aiUsageSummary(db: Db) {
  const rows = await db.query<{ today: number; failed: number; input_tokens: number; output_tokens: number }>(
    `select count(*)::int as today, count(*) filter (where not ok)::int as failed,
            coalesce(sum(input_tokens), 0)::int as input_tokens, coalesce(sum(output_tokens), 0)::int as output_tokens
       from ai_usage where created_at > now() - interval '1 day'`
  );
  return rows[0];
}
