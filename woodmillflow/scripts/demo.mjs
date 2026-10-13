// Starts WoodmillFlow for a laptop-hosted demonstration and prints the addresses to use.
// Usage: npm run demo   (builds first, then runs this script)
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const port = Number(process.env.PORT) || 3000;

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  const score = (ip) => (ip.startsWith('192.168.') || ip.startsWith('172.20.10.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return out.sort((a, b) => score(a) - score(b));
}

const nextBin = path.join(path.dirname(require.resolve('next/package.json')), 'dist', 'bin', 'next');
const server = spawn(process.execPath, [nextBin, 'start', '-H', '0.0.0.0', '-p', String(port)], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: process.env
});

let announced = false;
server.stdout.on('data', async (chunk) => {
  process.stdout.write(chunk);
  if (announced || !/ready|started|Local:/i.test(String(chunk))) return;
  announced = true;
  const lan = lanAddresses();
  const phoneUrl = process.env.APP_URL || (lan[0] ? `http://${lan[0]}:${port}` : null);
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  WoodmillFlow is running (independent concept demonstration)');
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  Laptop:  http://localhost:${port}`);
  if (phoneUrl) {
    console.log(`  iPhone:  ${phoneUrl}   (same Wi-Fi or Personal Hotspot)`);
    for (const extra of lan.slice(1)) console.log(`           http://${extra}:${port}   (other network adapter)`);
    console.log('\n  Scan with the iPhone camera to open the request form:\n');
    console.log(await QRCode.toString(`${phoneUrl}/request`, { type: 'terminal', small: true }));
  } else {
    console.log('  No network connection found — connect to Wi-Fi or a hotspot for the iPhone.');
  }
  console.log(
    process.env.DATABASE_URL || process.env.POSTGRES_URL
      ? '  Orders are saved in the configured PostgreSQL database.'
      : `  Orders are saved in ${process.env.WOODMILLFLOW_DATA_DIR || '.data/pglite'} and survive restarts.`
  );
  console.log('  Press Ctrl+C to stop.\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
