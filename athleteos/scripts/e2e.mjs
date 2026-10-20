// End-to-end smoke test at iPhone size using the pre-installed Chromium.
// Usage: npm run build && npx vite preview --port 4174 &   then   npm run e2e -- [screenshot-dir]
// Env: BASE_URL (default http://localhost:4174/), CHROMIUM_PATH (optional)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4174/';
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
});
const page = await ctx.newPage();
page.setDefaultTimeout(10_000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message.split('\n')[0]}`);
    console.log(`  ✗ ${name}\n      ${e.message.split('\n').slice(0, 4).join(' ')}`);
    await snap(`FAIL-${name.replace(/\W+/g, '-')}`);
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const snap = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: false });
const noHScroll = async () => {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert(sw <= w, `horizontal scroll: ${sw}px > ${w}px`);
};
const confirmDialog = async (label) => page.getByRole('alertdialog').getByRole('button', { name: label }).click();

console.log('AthleteOS end-to-end test');

await check('onboarding runs and preloads the programme', async () => {
  await page.goto(BASE);
  await page.getByText('Athlete', { exact: false }).first().waitFor();
  await noHScroll();
  await snap('01-welcome');
  await btn('Get started').click();
  await page.getByLabel('Body weight (kg)').fill('70');
  await btn('Continue').click();
  await btn('Continue').click(); // experience
  await btn('Continue').click(); // equipment
  await page.getByLabel('Injuries or limitations').fill('Left ankle a bit stiff');
  await btn('Continue').click();
  await snap('02-days');
  await btn('Enter my current weights').click();
  await page.getByText('Current weights').first().waitFor();
});

await check('starting weights are saved as a manual workout', async () => {
  const card = (name) => page.locator('div.rounded-2xl', { has: page.getByText(name, { exact: true }) }).first();
  await card('Lat pulldown').getByLabel('Weight (kg)').fill('30');
  await card('Lat pulldown').getByLabel('Reps').fill('12');
  await card('Seated cable row').getByLabel('Weight (kg)').fill('35');
  await card('Dumbbell bench press').getByLabel('Weight (kg)').fill('16');
  await snap('03-starting-weights');
  await btn('Save 3 weights').click();
  await page.getByText('Ready for progressive overload').waitFor();
});

await check('dashboard shows the overload recommendation with a reason', async () => {
  await page.getByText('Increase lat pulldown from 30 kg to 32.5 kg next session.').first().waitFor();
  await page.getByText('Remember:').waitFor();
  await page.getByText('70 kg').first().waitFor();
  await noHScroll();
  await snap('04-dashboard');
});

await check('check-in with elevated fatigue holds increases', async () => {
  await page.goto(`${BASE}#/train/start/tpl_mon`);
  await page.getByRole('radiogroup', { name: 'Energy' }).getByRole('radio', { name: '2', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Muscle soreness' }).getByRole('radio', { name: '4', exact: true }).click();
  await page.getByText('Consider a lighter session today').first().waitFor();
  await snap('05-checkin-amber');
  // Override and train as normal.
  await page.getByRole('switch', { name: 'Override recommendation' }).click();
  await btn('Start workout').click();
  await page.getByRole('heading', { name: 'Lat pulldown' }).waitFor();
});

await check('live workout pre-fills the suggested load and previous performance', async () => {
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Lat pulldown' }) });
  await card.getByText('Last (').waitFor();
  const w = await card.getByLabel('Set 1 weight (kg)', { exact: true }).inputValue();
  assert(w === '32.5', `expected 32.5 prefilled, got ${w}`);
  await card.getByText('Increase lat pulldown').first().waitFor();
  await noHScroll();
  await snap('06-live');
});

await check('logging sets saves immediately and survives a reload', async () => {
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Lat pulldown' }) });
  await card.getByRole('radiogroup', { name: 'Set 1 reps in reserve' }).getByRole('radio', { name: '2', exact: true }).click();
  await card.getByRole('radiogroup', { name: 'Set 1 technique' }).getByRole('radio', { name: 'Good' }).click();
  await card.getByRole('checkbox', { name: 'Set 1 completed' }).click();
  await page.getByRole('timer').waitFor();
  await snap('07-rest-timer');
  await card.getByLabel('Set 2 reps', { exact: true }).fill('11');
  await card.getByRole('checkbox', { name: 'Set 2 completed' }).click();
  await page.waitForTimeout(400);
  await page.reload();
  const again = page.locator('section', { has: page.getByRole('heading', { name: 'Lat pulldown' }) });
  await again.getByLabel('Set 2 reps', { exact: true }).waitFor();
  assert((await again.getByLabel('Set 2 reps', { exact: true }).inputValue()) === '11', 'set 2 reps not persisted');
  assert((await again.getByRole('checkbox', { name: 'Set 2 completed' }).getAttribute('aria-checked')) === 'true', 'set 2 not ticked after reload');
  await page.getByRole('timer').waitFor();
});

await check('finishing an incomplete workout warns and saves', async () => {
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByText('not ticked').waitFor();
  await confirmDialog('Finish workout');
  await page.getByText('Workout complete').first().waitFor();
  await page.getByRole('heading', { name: 'Next time' }).waitFor();
  await snap('08-summary');
  await btn('Done').click();
  await page.getByText('Full Body complete').waitFor();
});

await check('history lists both workouts; editing keeps a revision', async () => {
  await page.goto(`${BASE}#/history`);
  await page.getByText('2 workouts logged').waitFor();
  await noHScroll();
  await snap('09-history');
  await page.locator('a[href^="#/history/"]', { hasText: 'Full Body' }).first().click();
  await page.getByText('Recovery check-in').waitFor();
  await page.getByRole('button', { name: 'Edit workout' }).last().click();
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Lat pulldown' }) });
  await card.getByLabel('Set 2 reps', { exact: true }).fill('10');
  await btn('Save changes').click();
  await page.getByText('Edit history').waitFor();
  await page.getByText('Edited 1×').waitFor();
  await snap('10-session-detail');
});

await check('search filters history', async () => {
  await page.goto(`${BASE}#/history`);
  await page.getByLabel('Search history').fill('starting');
  await page.getByText('Starting weights').first().waitFor();
  assert((await page.locator('a[href^="#/history/"]').count()) === 1, 'search should leave one result');
});

await check('progress charts render with range filters and table view', async () => {
  await page.goto(`${BASE}#/progress`);
  await page.getByText('Weight lifted (kg)').waitFor();
  await page.locator('.recharts-surface').first().waitFor();
  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('button', { name: 'Show Weight lifted (kg) as table' }).click();
  await page.getByRole('cell', { name: '32.5 kg' }).first().waitFor();
  await noHScroll();
  await snap('11-progress');
  await page.getByRole('tab', { name: 'Training' }).click();
  await page.getByText('Workout frequency').waitFor();
  await page.getByRole('tab', { name: 'PRs' }).click();
  await snap('12-records');
});

await check('programme workouts can be reordered and edited', async () => {
  await page.goto(`${BASE}#/train/template/tpl_mon`);
  await page.getByRole('button', { name: 'Move Lat pulldown up' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Workout saved').waitFor();
  const names = await page.locator('ol li p.truncate').allTextContents();
  assert(names.indexOf('Lat pulldown') === names.indexOf('Seated cable row') - 1, `order wrong: ${names.join(', ')}`);
  await snap('13-template');
});

await check('exercise library search and custom exercise', async () => {
  await page.goto(`${BASE}#/library`);
  await page.getByLabel('Search exercises').fill('hamstring');
  await page.getByText('Nordic hamstring curl').waitFor();
  await page.goto(`${BASE}#/library/new`);
  await page.getByLabel('Name').fill('Trap bar deadlift');
  await page.getByRole('group', { name: 'Primary muscles' }).getByRole('button', { name: 'Glutes' }).click();
  await btn('Create exercise').click();
  await page.getByRole('heading', { name: 'Trap bar deadlift' }).waitFor();
});

await check('body weight logging and backups export', async () => {
  await page.goto(`${BASE}#/profile`);
  await page.getByLabel('Body weight in kg').fill('70.6');
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await page.getByText('Body weight logged').waitFor();
  const [json] = await Promise.all([page.waitForEvent('download'), btn('Export backup (JSON)').click()]);
  assert(/athleteos-backup-.*\.json/.test(json.suggestedFilename()), 'json filename');
  const [csv] = await Promise.all([page.waitForEvent('download'), btn('Export workouts (CSV)').click()]);
  assert(/\.csv$/.test(csv.suggestedFilename()), 'csv filename');
  await noHScroll();
  await snap('14-profile');
});

await check('no runtime errors', async () => {
  assert(errors.length === 0, errors.join(' | '));
});

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
