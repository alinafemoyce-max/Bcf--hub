import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/auth/server';
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionSecret } from '@/lib/auth/session';
import { readJson, route } from '@/lib/api';
import { UserError } from '@/lib/errors';

export const POST = route(
  async ({ req, db }) => {
    const expected = process.env.APP_PASSWORD?.trim();
    const secret = sessionSecret();
    if (!expected || !secret) throw new UserError('APP_PASSWORD is not set on the server yet. Add it to the environment variables.', 503, 'not_configured');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    await checkLoginRateLimit(db, ip);
    const { password } = await readJson(req, z.object({ password: z.string().min(1, 'Enter your password').max(500) }));
    const ok = await passwordMatches(password, expected);
    await recordLoginAttempt(db, ip, ok);
    if (!ok) throw new UserError('Incorrect password.', 401, 'bad_password');
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    return res;
  },
  { auth: false }
);
