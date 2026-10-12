import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Fictional demonstration data only: keep the prototype out of search engines.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
];

const nextConfig: NextConfig = {
  // Database drivers run only on the server and must not be bundled.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default nextConfig;
