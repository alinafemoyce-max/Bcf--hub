import { NextResponse, type NextRequest } from 'next/server';
import { accessCookieValue, accessCodeMatches } from './server/access';

/**
 * Optional private-demo gate. When DEMO_ACCESS_CODE is set, every page and API requires the code
 * (entered once, or carried by the QR code as ?key=…). When it is not set, the app is open, which
 * suits a laptop-hosted demonstration on a private network.
 */
export function proxy(req: NextRequest) {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;
  if (pathname === '/access' || pathname === '/api/access') return NextResponse.next();

  const expected = accessCookieValue(code);
  const key = searchParams.get('key');
  if (key !== null) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete('key');
    if (accessCodeMatches(key, code)) {
      const res = NextResponse.redirect(clean);
      res.cookies.set('wf_access', expected, {
        httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 14
      });
      return res;
    }
  }

  if (req.cookies.get('wf_access')?.value === expected) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Access code required.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/access';
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)']
};
