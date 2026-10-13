import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { DatabaseConfigError, getDb, type Database } from './db';
import { ServiceError, getUserIdByClock } from './orders';
import { getDemoRole, isDemoMode } from './session';
import { issuesToFieldErrors } from '@/lib/validation';
import { DEMO_OPERATOR } from '@/lib/config';

const MAX_BODY_BYTES = 64 * 1024;

export function jsonError(message: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ error: message, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

/** Wraps a route handler with consistent error handling and no-store caching. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      const res = await fn(req, ctx);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    } catch (err) {
      if (err instanceof ServiceError) return jsonError(err.message, err.status, err.fieldErrors);
      if (err instanceof ZodError) return jsonError('Please check the highlighted fields.', 422, issuesToFieldErrors(err));
      if (err instanceof DatabaseConfigError) return jsonError(err.message, 503);
      console.error('[woodmillflow] unexpected error', err);
      return jsonError('Something went wrong on the server. Please try again.', 500);
    }
  };
}

/**
 * Reads and validates a JSON body. Requiring application/json (and a same-origin Origin header when
 * the browser sends one) blocks cross-site form posts.
 */
export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new ServiceError('Expected a JSON request.', 415);
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) {
    throw new ServiceError('Cross-site requests are not allowed.', 403);
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ServiceError('Request is too large.', 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ServiceError('Invalid JSON.', 400);
  }
  return schema.parse(body);
}

/** Operator-only endpoints. In demo mode this checks the demo role; otherwise access is refused. */
export async function requireOperator(): Promise<{ db: Database; operatorId: string }> {
  if (!isDemoMode()) {
    throw new ServiceError('Operator sign-in is not configured. Enterprise authentication is required outside demo mode.', 403);
  }
  if ((await getDemoRole()) !== 'operator') {
    throw new ServiceError('Switch to the Woodmill Operator demo view to use the work queue.', 403);
  }
  const db = await getDb();
  const operatorId = await getUserIdByClock(db, DEMO_OPERATOR.clockNumber);
  if (!operatorId) throw new ServiceError('Demo operator account is missing. Reset the demo data.', 500);
  return { db, operatorId };
}
