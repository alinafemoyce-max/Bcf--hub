import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handler, jsonError, readJson } from '@/server/http';
import { ACCESS_COOKIE } from '@/server/session';
import { accessCookieValue, accessCodeMatches } from '@/server/access';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return NextResponse.json({ ok: true });
  const body = await readJson(req, z.object({ code: z.string().max(100) }));
  if (!accessCodeMatches(body.code.trim(), code)) return jsonError('That access code is not correct.', 403, { code: 'Incorrect code' });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, accessCookieValue(code), {
    httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 14
  });
  return res;
});
