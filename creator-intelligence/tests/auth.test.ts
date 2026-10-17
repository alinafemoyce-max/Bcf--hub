import { describe, expect, it } from 'vitest';
import { createSessionToken, passwordMatches, sessionSecret, verifySessionToken } from '../src/lib/auth/session';

describe('session tokens', () => {
  it('verifies a token signed with the same secret', async () => {
    const t = await createSessionToken('secret-one-123456');
    expect(await verifySessionToken(t, 'secret-one-123456')).toBe(true);
  });
  it('rejects tampered, foreign and expired tokens', async () => {
    const t = await createSessionToken('secret-one-123456');
    expect(await verifySessionToken(t, 'secret-two-123456')).toBe(false);
    const [p, s] = t.split('.');
    expect(await verifySessionToken(`${p}x.${s}`, 'secret-one-123456')).toBe(false);
    expect(await verifySessionToken('garbage', 'secret-one-123456')).toBe(false);
    expect(await verifySessionToken(t, null)).toBe(false);
    const old = await createSessionToken('secret-one-123456', Date.now() - 31 * 86400_000);
    expect(await verifySessionToken(old, 'secret-one-123456')).toBe(false);
  });
  it('derives a secret from the password when SESSION_SECRET is not set', () => {
    expect(sessionSecret({})).toBeNull();
    expect(sessionSecret({ APP_PASSWORD: 'pw', DATABASE_URL: 'postgres://x' })).toContain('postgres://x');
    expect(sessionSecret({ APP_PASSWORD: 'pw', SESSION_SECRET: 'a-long-explicit-secret' })).toBe('a-long-explicit-secret');
  });
  it('compares passwords', async () => {
    expect(await passwordMatches('hunter2', 'hunter2')).toBe(true);
    expect(await passwordMatches('hunter3', 'hunter2')).toBe(false);
  });
});
