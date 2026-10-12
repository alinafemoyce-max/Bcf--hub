import { createHash, timingSafeEqual } from 'node:crypto';

/** Optional shared access code for a privately hosted demonstration (DEMO_ACCESS_CODE). */
export function accessCookieValue(code: string): string {
  return createHash('sha256').update(`woodmillflow-access:${code}`).digest('base64url');
}

export function accessCodeMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
