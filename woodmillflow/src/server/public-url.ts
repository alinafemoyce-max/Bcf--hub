import { networkInterfaces } from 'node:os';
import { headers } from 'next/headers';

export interface PublicUrlInfo {
  /** Base URL the QR code should point to (no trailing slash). */
  baseUrl: string;
  source: 'configured' | 'current' | 'lan' | 'localhost';
  warning?: string;
  lanAddresses: string[];
}

const LOCAL_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(:\d+)?$/i;

export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  // Prefer typical home/office/hotspot ranges first.
  return out.sort((a, b) => score(a) - score(b));
}

function score(ip: string) {
  if (ip.startsWith('192.168.') || ip.startsWith('172.20.10.')) return 0;
  if (ip.startsWith('10.')) return 1;
  return 2;
}

/**
 * Works out which address a phone should use. Order of preference:
 *  1. APP_URL, if configured (for example the hosted https:// address)
 *  2. the address this page was opened with, unless it is localhost
 *  3. the laptop's local-network address (for a laptop-hosted demo)
 */
export async function resolvePublicUrl(): Promise<PublicUrlInfo> {
  const lan = lanAddresses();
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return { baseUrl: configured.replace(/\/+$/, ''), source: 'configured', lanAddresses: lan };

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0].trim();
  if (!LOCAL_HOSTS.test(host)) return { baseUrl: `${proto}://${host}`, source: 'current', lanAddresses: lan };

  const port = host.includes(':') ? host.split(':').pop() : '';
  if (lan.length) {
    return {
      baseUrl: `http://${lan[0]}${port ? `:${port}` : ''}`,
      source: 'lan',
      lanAddresses: lan,
      warning:
        'You opened WoodmillFlow as “localhost”, which a phone cannot reach. The QR code uses this computer’s network address instead — the phone must be on the same Wi-Fi or hotspot.'
    };
  }
  return {
    baseUrl: `${proto}://${host}`,
    source: 'localhost',
    lanAddresses: lan,
    warning: 'No network connection was found, so this QR code points to “localhost” and will not work on a phone.'
  };
}

/** Appends the private-demo access key, when one is configured, so a scan opens without a prompt. */
export function withAccessKey(url: string): string {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return url;
  const u = new URL(url);
  u.searchParams.set('key', code);
  return u.toString();
}
