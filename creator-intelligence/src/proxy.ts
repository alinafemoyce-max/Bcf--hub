import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from './lib/auth/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/manifest.webmanifest', '/robots.txt'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // Block cross-site state-changing requests (CSRF), in addition to SameSite cookies.
  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    // Compare with the Host the browser used (nextUrl can differ behind proxies and on Vercel).
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = 'invalid';
    }
    if (origin && originHost !== host) {
      return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 });
    }
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (ok) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: 'Your session has expired. Sign in again.', code: 'unauthorised' }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets and icons.
  matcher: ['/((?!_next/static|_next/image|icons/|favicon.ico|apple-touch-icon.png).*)']
};
