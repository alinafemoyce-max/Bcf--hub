import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Db } from '../db/client';
import { UserError } from '../errors';
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from './session';

/** For server components: redirects to /login unless signed in. Also marks the page as dynamic. */
export async function requirePageAuth(): Promise<void> {
  const store = await cookies();
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value, sessionSecret()))) redirect('/login');
}

/** For route handlers: throws 401 unless signed in (defence in depth behind proxy.ts). */
export async function requireApiAuth(): Promise<void> {
  const store = await cookies();
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value, sessionSecret()))) {
    throw new UserError('Your session has expired. Sign in again.', 401, 'unauthorised');
  }
}

export const LOGIN_LIMITS = { windowMinutes: 15, perIp: 8, global: 30 };

/** Throws if there have been too many failed sign-in attempts recently. */
export async function checkLoginRateLimit(db: Db, ip: string) {
  const rows = await db.query<{ ip_fails: number; all_fails: number }>(
    `select count(*) filter (where ip = $1)::int as ip_fails, count(*)::int as all_fails
       from login_attempts where not success and created_at > now() - make_interval(mins => $2)`,
    [ip, LOGIN_LIMITS.windowMinutes]
  );
  const r = rows[0];
  if (r && (r.ip_fails >= LOGIN_LIMITS.perIp || r.all_fails >= LOGIN_LIMITS.global)) {
    throw new UserError(`Too many failed attempts. Try again in ${LOGIN_LIMITS.windowMinutes} minutes.`, 429, 'rate_limited');
  }
}

export async function recordLoginAttempt(db: Db, ip: string, success: boolean) {
  await db.query('insert into login_attempts (ip, success) values ($1, $2)', [ip, success]);
  await db.query("delete from login_attempts where created_at < now() - interval '7 days'");
}
