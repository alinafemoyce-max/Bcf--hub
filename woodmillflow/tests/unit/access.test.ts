import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { accessCookieValue } from '@/server/access';

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, 'https://demo.example'), { headers: cookie ? { cookie } : {} });

afterEach(() => {
  delete process.env.DEMO_ACCESS_CODE;
});

describe('private demonstration access gate', () => {
  it('is open when no access code is configured', () => {
    const res = proxy(req('/operator'));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects pages and blocks APIs without the code', () => {
    process.env.DEMO_ACCESS_CODE = 'harbour-2026';
    const page = proxy(req('/operator'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('https://demo.example/access?next=%2Foperator');
    expect(proxy(req('/api/orders')).status).toBe(401);
  });

  it('accepts the key carried by the QR code and removes it from the address', () => {
    process.env.DEMO_ACCESS_CODE = 'harbour-2026';
    const res = proxy(req('/request?key=harbour-2026'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://demo.example/request');
    expect(res.headers.get('set-cookie')).toContain(`wf_access=${accessCookieValue('harbour-2026')}`);
  });

  it('rejects a wrong key and accepts a valid cookie', () => {
    process.env.DEMO_ACCESS_CODE = 'harbour-2026';
    expect(proxy(req('/request?key=wrong')).headers.get('location')).toContain('/access');
    const ok = proxy(req('/request', `wf_access=${accessCookieValue('harbour-2026')}`));
    expect(ok.headers.get('x-middleware-next')).toBe('1');
  });
});
