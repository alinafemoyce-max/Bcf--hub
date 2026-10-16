// End-to-end smoke test at iPhone size using the pre-installed Chromium.
// Usage: npm run build && npx vite preview --port 4174 &   then   npm run e2e -- [screenshot-dir]
// Env: BASE_URL (default http://localhost:4174/), CHROMIUM_PATH (optional)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4174/';
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const iphone = {
  viewport: { width: 375, height: 667 }, // iPhone SE – the narrowest common iPhone
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

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
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function newPage(ctxOpts = {}) {
  const ctx = await browser.newContext({ ...iphone, ...ctxOpts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  return page;
}
const btn = (page, name) => page.getByRole('button', { name });
const snap = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const noHScroll = async (page) => {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert(sw <= w, `horizontal scroll: content ${sw}px wider than ${w}px screen`);
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('nextstep:v1') || 'null'));

console.log('NextStep end-to-end test');
const page = await newPage();

await check('welcome screen loads with no errors', async () => {
  await page.goto(BASE);
  await page.getByText('Your future').waitFor();
  await noHScroll(page);
  await snap(page, '01-welcome');
});

await check('Home Screen tip shows on iPhone and can be dismissed', async () => {
  const tip = page.getByRole('complementary', { name: 'Keep your progress' });
  await tip.getByText(/Add to Home Screen/).waitFor();
  await tip.getByRole('button', { name: 'Got it' }).click();
  await page.reload();
  await page.getByText('Your future').waitFor();
  assert((await tip.count()) === 0, 'tip came back after dismissing');
  await page.evaluate(() => localStorage.removeItem('nextstep:install-tip-dismissed'));
});

await check('onboarding: answer, skip and finish', async () => {
  await page.getByRole('link', { name: /Get started/ }).click();
  await page.getByText('What best describes you?').waitFor();
  await page.getByRole('radio', { name: /Apprentice/ }).click();
  await btn(page, /^Next/).click();
  await page.getByPlaceholder(/Boatbuilder/).fill('laminator');
  await page.getByRole('button', { name: /Boat builder/ }).waitFor();
  await snap(page, '02-role');
  await btn(page, /^Next/).click();
  await page.getByText('Which industry are you in?').waitFor();
  const industry = await page.getByRole('radio', { name: /Manufacturing & boatbuilding/ }).getAttribute('aria-checked');
  assert(industry === 'true', 'industry not pre-selected from role');
  await btn(page, /^Next/).click();
  const row = (t) => page.locator('.qual-row', { hasText: t });
  await row('GCSE English and maths').getByRole('button', { name: 'Completed' }).click();
  await row('Advanced apprenticeship').getByRole('button', { name: 'Studying now' }).click();
  await btn(page, /^Next/).click();
  await btn(page, 'Skip this question').click(); // experience skipped
  await page.getByText('What interests you?').waitFor();
  await page.getByRole('checkbox', { name: /Leadership/ }).click();
  await page.getByRole('checkbox', { name: /Changing industries/ }).click();
  await btn(page, /See my pathways/).click();
  await page.getByText(/From boat builder/).waitFor();
  const s = await stored(page);
  assert(s.profile.roleSlug === 'boat-builder', 'role not saved');
  assert(s.profile.quals['gcse-em'] === 'done' && s.profile.quals.app3 === 'studying', 'qualification states wrong');
  assert(s.profile.experience === undefined, 'skipped question was saved');
  assert(s.profile.interests.join() === 'leadership,change', 'interests wrong');
});

await check('pathways show upward, sideways and cross-industry suggestions', async () => {
  for (const h of ['Upward progression', 'Sideways moves', 'Cross-industry']) await page.getByRole('heading', { name: h }).waitFor();
  const cards = await page.locator('a.ccard').count();
  assert(cards >= 6, `only ${cards} career cards`);
  await noHScroll(page);
  await snap(page, '03-paths');
});

await check('career details: role, why it suits, routes, steps and sources', async () => {
  await page.goto(`${BASE}#/career/marine-engineering-technician`);
  for (const h of ['Why it might suit you', 'What the role involves', 'Your transferable skills', 'Qualifications and entry routes', 'Steps from boat builder', 'Career progression']) {
    await page.getByRole('heading', { name: h }).waitFor();
  }
  await page.getByText('Checked source').first().waitFor();
  await page.getByText('Typical route').first().waitFor();
  await page.getByText(/Open Government Licence/).first().waitFor();
  await page.getByText('Apprenticeship', { exact: true }).click();
  await page.locator('details[open]').getByText(/you’ve told us you have this/).first().waitFor();
  await noHScroll(page);
  await snap(page, '04-career');
});

await check('saving a career adds it to the shortlist', async () => {
  await page.getByRole('button', { name: /^Save Marine/ }).click();
  await page.goto(`${BASE}#/saved`);
  await page.locator('a.ccard', { hasText: 'Marine engineering technician' }).waitFor();
  assert((await stored(page)).saved.includes('marine-engineering-technician'), 'not stored');
});

await check('career map: re-centre, route and return to start', async () => {
  await page.goto(`${BASE}#/map`);
  await page.getByText('You are here').waitFor();
  await page.locator('.node', { hasText: 'Supervisor' }).first().click();
  await btn(page, 'Re-centre the map here').click();
  await page.getByText('Exploring').waitFor();
  await btn(page, /Return to my starting position/).click();
  await page.getByText('You are here').waitFor();
  await page.goto(`${BASE}#/map/production-manager-manufacturing-`);
  const tabs = await page.getByRole('tab').count();
  assert(tabs >= 3, `expected several routes, got ${tabs}`);
  await page.getByRole('tab').nth(1).click();
  await page.locator('.step.target').waitFor();
  await noHScroll(page);
  await snap(page, '05-route');
});

await check('compare two careers', async () => {
  await page.goto(`${BASE}#/compare?a=boat-builder&b=carpenter`);
  await page.getByText('Typical salary (NCS)').waitFor();
  await page.getByLabel('Career 2').selectOption('welder');
  await page.waitForURL(/b=welder/);
  await noHScroll(page);
});

await check('action plan: tick items and keep them after reload', async () => {
  await page.goto(`${BASE}#/plan/marine-engineering-technician`);
  for (const h of ['This month', 'Skills to develop', 'Qualifications to research', 'Relevant experience', 'People to speak to', 'Longer-term milestones']) await page.getByRole('heading', { name: h }).waitFor();
  const first = page.getByRole('checkbox').first();
  await first.click();
  assert((await first.getAttribute('aria-checked')) === 'true', 'tick did not apply');
  await page.reload();
  assert((await page.getByRole('checkbox').first().getAttribute('aria-checked')) === 'true', 'tick lost after reload');
  await page.getByText(/1 of \d+ actions done/).waitFor();
  await snap(page, '06-plan');
});

await check('sharing shows a preview without personal details', async () => {
  await page.evaluate(() => {
    window.__shared = null;
    navigator.share = async (d) => {
      window.__shared = d;
    };
  });
  await btn(page, 'Share or export this plan').click();
  const preview = await page.locator('.preview-box').innerText();
  assert(!/laminator/i.test(preview), 'plan preview contains what the user typed');
  await page.getByRole('dialog').getByRole('button', { name: 'Share', exact: true }).click();
  const shared = await page.evaluate(() => window.__shared);
  assert(shared && /action plan/i.test(shared.text) && !/laminator/i.test(JSON.stringify(shared)), 'share payload wrong');
  await page.goto(`${BASE}#/career/carpenter`);
  await btn(page, 'Share this career').click();
  const url = await page.locator('.preview-box').innerText();
  assert(/#\/career\/carpenter$/.test(url.trim()), 'career link missing');
  assert(!/laminator|boat builder/i.test(url), 'career share contains profile details');
  await page.keyboard.press('Escape');
});

await check('interests questionnaire for undecided users', async () => {
  await page.goto(`${BASE}#/discover`);
  await page.getByText(/not a scientific/).waitFor();
  for (let i = 0; i < 7; i++) {
    await page.getByRole('radio').first().click();
    await page.waitForTimeout(350);
  }
  await page.getByRole('checkbox', { name: /Workshop/ }).click();
  await btn(page, /See my matches/).click();
  await page.getByText('Here’s where your interests point').waitFor();
  await page.getByText('Top match').waitFor();
  await noHScroll(page);
  await snap(page, '07-quiz-results');
});

await check('explore: search and filter', async () => {
  await page.goto(`${BASE}#/explore`);
  await page.getByPlaceholder(/Search/).fill('nurse');
  await page.locator('a.ccard', { hasText: 'Nurse' }).first().waitFor();
  await page.getByPlaceholder(/Search/).fill('zzzqqq');
  await page.getByText(/No careers match/).waitFor();
});

await check('every main screen fits the narrow iPhone screen', async () => {
  for (const h of ['#/', '#/paths', '#/explore', '#/map', '#/saved', '#/about', '#/career/nurse', '#/plan/chef', '#/discover/results', '#/compare?a=nurse&b=paramedic', '#/start?q=4']) {
    await page.goto(BASE + h);
    await page.waitForTimeout(250);
    await noHScroll(page);
  }
});

await check('empty and error states', async () => {
  await page.goto(`${BASE}#/career/not-a-real-career`);
  await page.getByText('We couldn’t find that career').waitFor();
  await page.goto(`${BASE}#/nowhere`);
  await page.getByText('This page doesn’t exist').waitFor();
  const fresh = await newPage();
  await fresh.goto(`${BASE}#/saved`);
  await fresh.getByText('Nothing saved yet').waitFor();
  await fresh.goto(`${BASE}#/paths`);
  await fresh.getByText('Let’s find your next steps').waitFor();
  await fresh.evaluate(() => localStorage.setItem('nextstep:v1', '{not json'));
  await fresh.goto(`${BASE}#/paths`);
  await fresh.reload();
  await fresh.getByText('Let’s find your next steps').waitFor();
  assert(fresh.errors.length === 0, `errors: ${fresh.errors.join('; ')}`);
});

await check('a second visitor starts with their own independent experience', async () => {
  const other = await newPage();
  await other.goto(BASE);
  await other.getByRole('link', { name: /Get started/ }).waitFor();
  assert((await stored(other)) === null, 'new visitor saw existing data');
});

await check('reset deletes all data after confirmation', async () => {
  await page.goto(`${BASE}#/about`);
  await page.getByText(/Stored on this device right now/).waitFor();
  await btn(page, /Reset and delete my data/).click();
  await btn(page, 'Yes, delete my data').click();
  await page.getByRole('link', { name: /Get started/ }).waitFor();
  assert((await stored(page)) === null || (await stored(page)).profile === null, 'data still stored');
  await page.goto(`${BASE}#/saved`);
  await page.getByText('Nothing saved yet').waitFor();
});

await check('works on a wide desktop screen', async () => {
  const desk = await newPage({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, userAgent: undefined, deviceScaleFactor: 1 });
  await desk.goto(`${BASE}#/career/carpenter`);
  await desk.getByRole('heading', { name: 'What the role involves' }).waitFor();
  await desk.goto(BASE);
  await desk.getByText('Your future').waitFor();
  assert((await desk.getByRole('complementary', { name: 'Keep your progress' }).count()) === 0, 'Home Screen tip shown on desktop');
  await desk.goto(`${BASE}#/career/carpenter`);
  await noHScroll(desk);
  await snap(desk, '08-desktop');
});

await check('no JavaScript errors during the run', async () => assert(page.errors.length === 0, page.errors.join('; ')));

await browser.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
