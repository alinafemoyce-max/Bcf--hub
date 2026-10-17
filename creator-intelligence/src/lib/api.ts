import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { requireApiAuth } from './auth/server';
import { DatabaseNotConfiguredError, getDb, type Db } from './db';
import { UserError } from './errors';
import { firstIssue } from './validation';

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: checks the session, provides the database, and turns errors into
 * JSON responses ({ error, code, details }) with a sensible status code.
 */
export function route<P = Record<string, never>>(
  handler: (args: { req: Request; db: Db; params: P }) => Promise<Response | unknown>,
  opts: { auth?: boolean } = {}
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (opts.auth !== false) await requireApiAuth();
      const db = await getDb();
      const result = await handler({ req, db, params: ctx?.params ? await ctx.params : ({} as P) });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown) {
  if (error instanceof UserError) {
    return NextResponse.json({ error: error.message, code: error.code, details: error.details ?? null }, { status: error.status });
  }
  if (error instanceof ZodError) return NextResponse.json({ error: firstIssue(error), code: 'invalid_input' }, { status: 400 });
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: error.message, code: 'db_not_configured' }, { status: 503 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request body.', code: 'invalid_json' }, { status: 400 });
  console.error('[api] unexpected error', error);
  return NextResponse.json({ error: 'Something went wrong on the server. Nothing was changed.', code: 'server_error' }, { status: 500 });
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}
