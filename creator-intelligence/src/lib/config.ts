import 'server-only';
import { aiModel, isAiConfigured } from './ai/config';

/** Which pieces of configuration are present (never returns secret values). */
export function configStatus() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const localDbAllowed = !process.env.VERCEL && (process.env.NODE_ENV !== 'production' || Boolean(process.env.ALLOW_LOCAL_DB));
  return {
    database: hasDatabaseUrl ? ('postgres' as const) : localDbAllowed ? ('local' as const) : ('missing' as const),
    password: Boolean(process.env.APP_PASSWORD?.trim()),
    ai: isAiConfigured(),
    model: aiModel()
  };
}
