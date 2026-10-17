// Signed session tokens (HMAC-SHA256 via Web Crypto). Used by proxy.ts and route handlers.
// This is a single-user app: whoever knows APP_PASSWORD is the owner.

export const SESSION_COOKIE = 'ajm_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * The signing secret: SESSION_SECRET if set, otherwise derived from APP_PASSWORD and DATABASE_URL
 * (the database URL contains a random password, so the derived key is not guessable).
 * Changing APP_PASSWORD therefore signs everyone out.
 */
export function sessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.SESSION_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  const password = env.APP_PASSWORD?.trim();
  if (!password) return null;
  return `derived:v1:${password}:${env.DATABASE_URL ?? 'local'}`;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify({ v: 1, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined | null, secret: string | null, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return false;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig) as BufferSource, encoder.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { v?: number; exp?: number };
    return data.v === 1 && typeof data.exp === 'number' && data.exp * 1000 > now;
  } catch {
    return false;
  }
}

/** Constant-time password comparison (compares SHA-256 digests). */
export async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
