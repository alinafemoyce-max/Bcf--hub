// End-to-end smoke test: builds nothing, expects `next build` to have run.
// Starts the production server against a test database, plus a local stand-in for the
// Anthropic Messages API (test harness only), then drives the app in Chromium at iPhone size.
//
// Usage: E2E_DATABASE_URL=postgres://... node scripts/e2e.mjs
// (Without E2E_DATABASE_URL it uses a temporary embedded PGlite database.)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';

const PORT = 3123;
const MOCK_PORT = 4011;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = new URL('../e2e-shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

// ---- Stand-in Anthropic API: replies with queued responses in order ----
const queue = [];
const requests = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const parsed = JSON.parse(body || '{}');
    requests.push({ url: req.url, headers: req.headers, body: parsed });
    const next = queue.shift() ?? { status: 500, error: 'no queued response' };
    if (next.status !== 200) {
      res.writeHead(next.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: next.error } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: parsed.model,
        content: [{ type: 'text', text: JSON.stringify(next.extraction) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1500, output_tokens: 600 }
      })
    );
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));

const row = (title, published, views, extra = {}) => ({
  title_text: title,
  title_truncated: false,
  published_text: published,
  views_text: views,
  likes_text: null,
  comments_text: null,
  shares_text: null,
  saves_text: null,
  duration_text: null,
  tiktok_url_or_id: null,
  thumbnail_box: { x: 0.05, y: 0.1, width: 0.2, height: 0.12 },
  partially_visible: false,
  uncertain_fields: [],
  notes: null,
  ...extra
});
const listExtraction = (rows) => ({
  is_tiktok_screen: true,
  screen_description: 'TikTok Studio posts list',
  observed_date_text: null,
  videos: rows,
  video_detail: null,
  account: null,
  warnings: []
});

// ---- App server ----
const dataDir = '/tmp/ajm-e2e-pglite';
rmSync(dataDir, { recursive: true, force: true });
const env = {
  ...process.env,
  PORT: String(PORT),
  APP_PASSWORD: 'correct horse',
  ANTHROPIC_API_KEY: 'test-key',
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  INSECURE_COOKIES: '1',
  NEXT_TELEMETRY_DISABLED: '1'
};
if (process.env.E2E_DATABASE_URL) env.DATABASE_URL = process.env.E2E_DATABASE_URL;
else {
  delete env.DATABASE_URL;
  env.ALLOW_LOCAL_DB = '1';
  env.LOCAL_DB_DIR = dataDir;
}
const nextBin = new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname;
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/login`);
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

// Synthetic "screenshot" images (unique content each).
async function makeImage(label) {
  const p = await context.newPage();
  await p.setViewportSize({ width: 590, height: 1278 });
  await p.setContent(`<body style="margin:0;background:#111;color:#eee;font:28px sans-serif;padding:40px">${label}<br>${Date.now()}</body>`);
  const buf = await p.screenshot({ type: 'png' });
  await p.close();
  return { name: `${label}.png`, mimeType: 'image/png', buffer: buf };
}

try {
  // Auth
  await page.goto(`${BASE}/`);
  check(page.url().includes('/login'), 'unauthenticated visit redirects to /login');
  const apiNoAuth = await fetch(`${BASE}/api/export`);
  check(apiNoAuth.status === 401, 'API rejects requests without a session (401)');
  await shot('01-login');
  await page.fill('input[type=password]', 'wrong');
  await page.click('button[type=submit]');
  await page.getByText('Incorrect password').waitFor();
  check(true, 'wrong password shows an error');
  await page.fill('input[type=password]', 'correct horse');
  await page.click('button[type=submit]');
  await page.waitForURL(`${BASE}/`);
  await page.getByText('Welcome').waitFor();
  check(true, 'login works and shows empty-state home');
  await shot('02-home-empty');

  // Import a list screenshot (AI path via the stand-in API)
  queue.push({
    status: 200,
    extraction: listExtraction([
      row('Is 85 horsepower enough for your first car?', '2025-09-01', '12.3K'),
      row('Cheapest cars to insure at 17', '2025-09-08', '4,210'),
      row('POV: first drive in my Fiesta', '2025-09-15', '980')
    ])
  });
  const img1 = await makeImage('list-one');
  await page.goto(`${BASE}/import`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles(img1);
  await page.getByText('Ready to review').waitFor({ timeout: 30000 });
  check(true, 'upload + AI extraction completes');
  const req = requests[0];
  check(req?.url?.startsWith('/v1/messages'), 'app called the Messages API');
  check(req?.headers['anthropic-beta']?.includes('server-side-fallback-2026-07-01'), 'request opts into server-side fallbacks');
  check(req?.body?.model === 'claude-opus-5-5' && req?.body?.output_config?.format?.type === 'json_schema', 'request uses claude-opus-5-5 with structured output');
  check(req?.body?.messages?.[0]?.content?.[0]?.type === 'image', 'request includes the screenshot image');
  await shot('03-import-uploaded');
  await page.getByRole('button', { name: /Start reviewing/ }).click();
  await page.waitForURL(/\/import\/[0-9a-f-]{36}/);
  await page.getByText('Videos found').waitFor();
  check((await page.locator('input[value="Is 85 horsepower enough for your first car?"]').count()) === 1, 'review form is prefilled with extracted titles');
  check((await page.getByText('≈ 12,300').count()) === 1, 'rounded values are shown as approximate');
  await shot('04-review');
  await page.getByRole('button', { name: 'Confirm and save' }).click();
  await page.getByText('Saved').first().waitFor();
  check((await page.getByText('3 new video record(s)').count()) === 1, 'confirm creates 3 videos');
  await shot('05-review-saved');

  // Same file again: duplicate detection
  await page.goto(`${BASE}/import`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles(img1);
  await page.getByText('Already imported earlier').waitFor();
  check(true, 'uploading the same screenshot twice is detected');

  // Overlapping list screenshot: one existing video (now more views) + one new
  queue.push({
    status: 200,
    extraction: listExtraction([row('POV: first drive in my Fiesta', '2025-09-15', '1,450'), row('Corsa vs Fiesta: which is better?', '2025-09-22', '25.1K')])
  });
  const img2 = await makeImage('list-two');
  await page.locator('input[type=file]').setInputFiles(img2);
  await page.getByText('Ready to review').waitFor({ timeout: 30000 });
  await page.getByRole('link', { name: 'Review' }).first().click();
  await page.getByText('Videos found').waitFor();
  check((await page.getByText('Likely the same').count()) >= 1, 'overlapping entry is matched to the existing video');
  await shot('06-review-match');
  await page.getByRole('button', { name: 'Confirm and save' }).click();
  await page.getByText('Saved').first().waitFor();
  check((await page.getByText('1 new video record(s)').count()) === 1, 'only the genuinely new video is created');
  check((await page.getByText('2 dated snapshot(s) added').count()) === 1, 'matched video gets a new snapshot');

  // AI failure path: error is shown, nothing invented, manual entry possible
  // One attempt plus one SDK retry.
  queue.push({ status: 500, error: 'overloaded' });
  queue.push({ status: 500, error: 'overloaded' });
  const img3 = await makeImage('list-fail');
  await page.goto(`${BASE}/import`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type=file]').setInputFiles(img3);
  await page.getByText(/AI service returned an error/).waitFor({ timeout: 60000 });
  check(true, 'AI failure is reported, not replaced with invented data');
  await page.getByRole('link', { name: 'Review' }).first().click();
  await page.getByText('The AI could not read this screenshot').waitFor();
  await shot('07-review-failed');

  // Manual video + snapshot
  await page.goto(`${BASE}/videos/new`);
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Title") input').first().fill('Why I sold my first car after 6 months');
  await page.locator('input[type=date]').first().fill(new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10));
  await page.locator('input[type=time]').first().fill('18:30');
  await page.locator('label:has-text("Category") select').selectOption('Ownership experiences');
  await page.getByRole('button', { name: 'Add video' }).click();
  await page.waitForURL(/\/videos\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Add metrics manually' }).click();
  await page.locator('label:has-text("Views") input').fill('2.4K');
  await page.locator('label:has-text("Likes") input').fill('310');
  await page.locator('label:has-text("Comments") input').fill('42');
  await page.locator('label:has-text("Shares") input').fill('17');
  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByText('Snapshot history (1)').waitFor();
  check(true, 'manual video and snapshot saved');
  await shot('08-video-detail');

  // Followers
  await page.goto(`${BASE}/account`);
  await page.waitForLoadState('networkidle');
  const when = page.locator('input[type=datetime-local]');
  await page.locator('label:has-text("Followers") input').fill('1,320');
  await when.fill(new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByText('History (1)').waitFor();
  await page.locator('label:has-text("Followers") input').fill('1,520');
  await when.fill(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Save snapshot' }).click();
  await page.getByText('History (2)').waitFor();
  check(true, 'account snapshots saved');

  // Dashboard
  await page.goto(`${BASE}/?range=all`);
  await page.getByText('Performance trend').waitFor();
  check((await page.getByText('+200 since').count()) === 1, 'dashboard shows follower growth from snapshots');
  await shot('09-home-dashboard');
  await page.goto(`${BASE}/?range=7d`);
  await shot('10-home-7d');

  // Library
  await page.goto(`${BASE}/videos`);
  await page.waitForLoadState('networkidle');
  check((await page.locator('a[href^="/videos/"]').filter({ hasText: 'views' }).count()) >= 5, 'library lists all videos');
  await page.fill('input[type=search]', 'fiesta');
  await page.waitForURL(/q=fiesta/);
  await page.waitForTimeout(500);
  await shot('11-videos-search');

  // Ideas
  await page.goto(`${BASE}/ideas`);
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Idea title") input').fill('Is 90hp enough for a new driver?');
  await page.getByRole('button', { name: 'Save idea' }).click();
  await page.getByRole('heading', { name: 'Is 90hp enough for a new driver?' }).waitFor();
  check(true, 'idea saved');
  await shot('12-ideas');

  await page.goto(`${BASE}/strategist`);
  await shot('13-strategist');
  await page.goto(`${BASE}/settings`);
  await shot('14-settings');
  const exp = await page.request.get(`${BASE}/api/export`);
  const data = await exp.json();
  check(exp.ok() && data.videos.length === 5 && data.videoSnapshots.length === 6, 'export contains all videos and snapshots');

  // CSRF protection
  const csrf = await page.request.post(`${BASE}/api/ideas`, { headers: { Origin: 'https://evil.example' }, data: { title: 'x' } });
  check(csrf.status() === 403, 'cross-site POST is blocked');

  // Horizontal overflow check at 390px on each main screen
  for (const path of ['/', '/videos', '/import', '/strategist', '/ideas', '/settings', '/account']) {
    await page.goto(`${BASE}${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no horizontal scroll on ${path}`);
  }
  check(consoleErrors.length === 0, `no browser console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`);
} catch (error) {
  failures.push(String(error));
  console.error(error);
  await shot('zz-failure').catch(() => {});
} finally {
  await browser.close();
  server.kill('SIGTERM');
  mock.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  console.error(serverLog.split('\n').slice(-40).join('\n'));
  process.exit(1);
}
console.log('\nAll end-to-end checks passed. Screenshots in e2e-shots/');
process.exit(0);
