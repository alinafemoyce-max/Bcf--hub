import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handler, jsonError, readJson } from '@/server/http';
import { isDemoMode, ROLE_COOKIE } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Switches the demonstration role. Disabled entirely when DEMO_MODE=false. */
export const POST = handler(async (req: NextRequest) => {
  if (!isDemoMode()) return jsonError('Role switching is only available in demo mode.', 403);
  const { role } = await readJson(req, z.object({ role: z.enum(['employee', 'operator']) }));
  const res = NextResponse.json({ role });
  res.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
});
