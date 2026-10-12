// End-to-end smoke test of the built app in an iPhone-sized Chromium window.
// Usage: npm run build && npx vite preview --port 4173 &  then
//        CHROMIUM_PATH=/path/to/chrome node scripts/e2e.mjs [screenshotDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const SHOTS = process.argv[2] || 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write']
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

let step = 0;
async function shot(name) {
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`layout: ${name} overflows horizontally by ${overflow}px`);
  await page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, '0')}-${name}.png`, fullPage: true });
}
function check(cond, msg) {
  if (!cond) throw new Error(`Check failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}
const go = (hash) => page.goto(`${BASE}#${hash}`);
const text = (sel) => page.locator(sel).first().innerText();
const sheet = () => page.locator('.sheet');
const toastSeen = async (t) => (await page.locator('.toast', { hasText: t }).count()) > 0;

console.log('Home & onboarding');
await page.goto(BASE);
await page.getByText('Welcome to BCF Hub').waitFor();
await shot('welcome');
await page.getByRole('button', { name: 'Explore with demo data' }).click();
await page.locator('.banner-demo').waitFor();
check((await page.locator('.stat').count()) === 4, 'four dashboard cards');
const active = Number(await text('.stat >> nth=0 >> .stat-value'));
const overdue = Number(await text('.stat >> nth=2 >> .stat-value'));
check(active > 0 && overdue > 0, `dashboard shows ${active} active, ${overdue} overdue`);
check(await page.locator('.meeting-hero').isVisible(), 'upcoming BCF card');
check((await page.locator('.action-row').count()) > 0, 'priority actions listed');
await shot('home');

console.log('Dashboard card navigation');
await page.locator('.stat', { hasText: 'Overdue' }).click();
await page.waitForURL(/view=overdue/);
check((await page.locator('.issue-row').count()) === overdue, 'overdue card opens matching overdue list');
await shot('issues-overdue');

console.log('Issue validation & creation');
await go('/issues/new');
await page.getByRole('button', { name: 'Create issue' }).click();
check((await page.locator('.field-msg').count()) >= 3, 'empty form shows validation errors');
await page.getByLabel('Issue title').fill('Drinking water fountain broken in assembly bay');
await page.getByLabel('Description').fill('The fountain near bay 3 has not worked for a week. Apprentices are buying bottled water.');
await page.getByLabel('Department or shed').selectOption('Hull & Deck Assembly');
await page.getByLabel('Category').selectOption('Welfare & Facilities');
await page.getByLabel('Priority').selectOption('High');
await page.getByLabel('Action owner / responsible role').fill('Facilities Lead');
await shot('issue-form');
await page.getByRole('button', { name: 'Create issue' }).click();
await page.locator('.detail-title', { hasText: 'Drinking water' }).waitFor();
const ref = await text('.detail-hero .ref');
check(/^BCF-\d{4}$/.test(ref), `created issue ${ref}`);

console.log('Issue workflow');
await page.locator('.qa', { hasText: 'Status' }).click();
await sheet().getByRole('radio', { name: /Raised with Management/ }).click();
await sheet().getByRole('button', { name: 'Save' }).click();
await page.locator('.detail-hero .badge', { hasText: 'Raised with Management' }).waitFor();
await page.locator('.qa', { hasText: 'Response' }).click();
await sheet().getByLabel('Response from management').fill('Engineering will replace the fountain filter this week.');
await sheet().getByRole('button', { name: 'Save' }).click();
await page.locator('.detail-hero .badge', { hasText: 'In Progress' }).waitFor();
check(true, 'recording a response moves status to In Progress');
await page.locator('.qa', { hasText: 'Follow-up' }).click();
await sheet().getByRole('button', { name: 'In 3 days' }).click();
await sheet().getByRole('button', { name: 'Save' }).click();
await page.locator('.qa', { hasText: 'Note' }).click();
await sheet().getByLabel('Note').fill('Chased by email.');
await sheet().getByRole('button', { name: 'Add note' }).click();
await page.waitForTimeout(300);
const historyCount = await page.locator('.timeline .tl').count();
check(historyCount >= 5, `activity history has ${historyCount} entries`);
// Resolve requires notes
await page.locator('.qa', { hasText: 'Status' }).click();
await sheet().getByRole('radio', { name: /^Resolved/ }).click();
await sheet().getByRole('button', { name: 'Save' }).click();
check(await sheet().locator('.field-msg').isVisible(), 'resolving without notes is blocked');
await sheet().getByLabel('Resolution notes').fill('Filter replaced; confirmed working with apprentices.');
await sheet().getByRole('button', { name: 'Save' }).click();
await page.locator('.detail-hero .badge', { hasText: 'Resolved' }).waitFor();
await shot('issue-detail');
await page.getByRole('button', { name: 'Archive issue' }).click();
await page.getByRole('button', { name: 'Restore from archive' }).waitFor();
check(true, 'archive and restore available');
await page.getByRole('button', { name: 'Restore from archive' }).click();

console.log('Search, filter & sort');
await go('/issues?view=all');
await page.getByPlaceholder('Search issues, IDs, responses…').fill(ref);
await page.waitForTimeout(150);
check((await page.locator('.issue-row').count()) === 1, 'search by ID finds one issue');
await page.getByPlaceholder('Search issues, IDs, responses…').fill('');
await page.getByRole('button', { name: /Filter and sort/ }).click();
await sheet().getByLabel('Priority').selectOption('High');
await sheet().getByRole('button', { name: 'Apply' }).click();
const highRows = await page.locator('.issue-row').count();
const highBadges = await page.locator('.issue-row .prio-high').count();
check(highRows > 0 && highRows === highBadges, `priority filter shows ${highRows} high-priority issues only`);
await shot('issues-filtered');

console.log('Meetings');
await go('/meetings');
await page.locator('.cal-cell.has').first().waitFor();
await shot('meetings');
await page.locator('.list .row', { hasText: 'Business Communication Forum' }).first().click();
await page.locator('.detail-title').waitFor();
const before = await page.locator('.agenda-item').count();
await page.getByRole('button', { name: 'Add issues' }).click();
await sheet().locator('.pick').first().click();
await sheet().locator('.pick').nth(1).click();
await sheet().getByRole('button', { name: 'Add 2' }).click();
await page.waitForTimeout(300);
check((await page.locator('.agenda-item').count()) === before + 2, 'two issues added to agenda');
await page.locator('.agenda-item').nth(0).getByRole('button', { name: 'Record' }).click();
await sheet().getByLabel('Management response').fill('Planning will flag college days on the rota from next month.');
await sheet().getByLabel('Decision / outcome').fill('Planning lead to update rota template and confirm at next forum.');
await sheet().getByRole('button', { name: 'Save' }).click();
await page.locator('.agenda-item').nth(0).getByRole('button', { name: 'Update issue' }).click();
await sheet().getByRole('button', { name: 'Update issue' }).click();
await page.waitForTimeout(300);
await page.locator('.agenda-item').nth(0).getByRole('button', { name: 'Create action' }).click();
await sheet().getByLabel('Action owner / responsible role').fill('Production Planning Lead');
await sheet().getByRole('button', { name: 'Create action' }).click();
await page.locator('.action-link').first().waitFor();
check(true, 'decision converted into tracked action');
await page.locator('.agenda-item').nth(1).getByRole('button', { name: /down/ }).click();
await page.getByRole('button', { name: 'Add', exact: false }).filter({ hasText: 'Add' }).last().click();
await sheet().getByLabel('Follow-up').fill('Send minutes to forum chair');
await sheet().getByRole('button', { name: 'Add' }).click();
await page.locator('.check-row', { hasText: 'Send minutes' }).waitFor();
await page.locator('.check-row', { hasText: 'Send minutes' }).getByRole('checkbox').click();
check(true, 'follow-up checklist add + tick');
await page.getByRole('button', { name: 'Agenda PDF' }).click();
await page.locator('.sheet', { hasText: 'Agenda PDF ready' }).waitFor({ timeout: 15000 });
const [dl] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: 'Download' }).click()]);
check(/agenda-.*\.pdf$/.test(dl.suggestedFilename()), `agenda PDF downloaded (${dl.suggestedFilename()})`);
await dl.saveAs(`${SHOTS}/agenda.pdf`);
await page.getByRole('button', { name: 'Minutes PDF' }).click();
await page.locator('.sheet', { hasText: 'Minutes PDF ready' }).waitFor({ timeout: 15000 });
const [dl2] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: 'Download' }).click()]);
await dl2.saveAs(`${SHOTS}/minutes.pdf`);
check(true, 'minutes PDF downloaded');
await page.getByLabel('General minutes').fill('Forum reviewed apprentice points; outcomes recorded per item.');
await page.getByRole('button', { name: 'Save minutes' }).click();
await page.getByRole('switch', { name: 'Notes approved' }).click();
await sheet().getByRole('button', { name: 'Mark approved' }).click();
await page.waitForTimeout(250);
await shot('meeting-detail');
await page.getByRole('button', { name: 'Generate Teams summary' }).click();
await page.waitForURL(/#\/updates\//);
const body = await page.getByLabel('Message').inputValue();
check(body.includes('Planning will flag college days'), 'summary generated from approved notes');

console.log('Communications');
await page.getByRole('button', { name: 'Copy text' }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check(clip === body, 'copy to clipboard works');
await page.getByRole('radio', { name: /Approved/ }).click();
await page.locator('.flow-step.active', { hasText: 'Approved' }).waitFor();
await page.getByRole('radio', { name: /Published/ }).click();
await sheet().getByRole('button', { name: 'Mark published' }).click();
await page.locator('.flow-step.active', { hasText: 'Published' }).waitFor();
check((await page.locator('.timeline .tl').count()) >= 3, 'communication history recorded');
await shot('update-editor');
await go('/updates');
await shot('updates');

console.log('Feedback');
await go('/feedback?new=1');
await sheet().getByLabel('Department or shed').selectOption('Mechanical & Engineering');
await sheet().getByLabel('Category').selectOption('Tools & Equipment');
await sheet().getByLabel('What was raised?').fill('Torque wrench is away for calibration again, jobs on hold.');
await page.waitForTimeout(200);
check(await sheet().locator('.similar').isVisible(), 'similar feedback detected while typing');
await shot('feedback-form');
await sheet().getByRole('button', { name: 'Save', exact: true }).click();
await page.locator('.sheet', { hasText: 'Convert to new issue' }).waitFor();
await sheet().getByRole('button', { name: 'Convert to new issue' }).click();
await page.waitForURL(/issues\/new\?feedback=/);
await page.getByLabel('Issue title').fill('Second torque wrench for apprentice bay');
await page.getByRole('button', { name: 'Create issue' }).click();
await page.locator('.detail-title', { hasText: 'Second torque wrench' }).waitFor();
check((await page.locator('.section', { hasText: 'Linked feedback (1)' }).count()) === 1, 'feedback converted to issue and linked');
await go('/feedback');
check((await page.locator('.concern').count()) > 0, 'repeated concerns shown');
await shot('feedback');

console.log('Planner & reports');
await go('/planner');
await page.getByRole('textbox', { name: 'Priority 1' }).fill('Chase rota response');
await page.getByRole('button', { name: 'Save plan' }).click();
await page.waitForTimeout(200);
await shot('planner');
await go('/reports');
await page.locator('.kpi').first().waitFor();
check((await page.locator('.bar-row').count()) > 3, 'report bars rendered');
await shot('reports');
await page.getByRole('button', { name: 'PDF' }).click();
await page.locator('.sheet', { hasText: 'Report PDF ready' }).waitFor({ timeout: 15000 });
const [dl3] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: 'Download' }).click()]);
await dl3.saveAs(`${SHOTS}/report.pdf`);
check(true, 'report PDF downloaded');
await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: `${SHOTS}/report-print.png`, fullPage: true });
await page.emulateMedia({ media: 'screen' });

console.log('Backup, restore & demo data');
await go('/settings');
await page.getByRole('button', { name: 'Export backup' }).click();
await page.locator('.sheet', { hasText: 'Backup ready' }).waitFor();
const [bk] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: 'Download' }).click()]);
const backupPath = `${SHOTS}/backup.json`;
await bk.saveAs(backupPath);
check(/bcf-hub-backup-.*\.json/.test(bk.suggestedFilename()), 'backup exported');
const issuesBeforeClear = await page.locator('.count-grid div').first().locator('strong').innerText();
await page.getByRole('button', { name: 'Clear all demo data' }).click();
await sheet().getByRole('button', { name: 'Clear demo data' }).click();
await page.waitForTimeout(400);
const issuesAfterClear = await page.locator('.count-grid div').first().locator('strong').innerText();
check(Number(issuesAfterClear) === 3, `demo cleared, own issues kept (${issuesBeforeClear} → ${issuesAfterClear})`);
await page.locator('input[type=file]').setInputFiles(backupPath);
await sheet().getByRole('button', { name: 'Replace and restore' }).click();
await page.waitForTimeout(400);
check((await page.locator('.count-grid div').first().locator('strong').innerText()) === issuesBeforeClear, 'backup restored');
await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
await page.waitForTimeout(200);
check(await toastSeen('not a BCF Hub backup'), 'invalid backup rejected with message');
await shot('settings');

console.log('Persistence & offline');
await page.reload();
await page.locator('.count-grid').waitFor();
check((await page.locator('.count-grid div').first().locator('strong').innerText()) === issuesBeforeClear, 'data persists across reload');
await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 }).catch(() => undefined);
await context.setOffline(true);
await page.goto(`${BASE}#/issues`);
await page.locator('.issue-row').first().waitFor({ timeout: 10000 });
check(true, 'app loads offline from the service worker cache');
await context.setOffline(false);

const external = [];
page.on('request', (r) => {
  if (!r.url().startsWith(BASE)) external.push(r.url());
});
await go('/');
await page.waitForTimeout(500);
check(external.length === 0, 'no third-party network requests');

await browser.close();
if (problems.length) {
  console.log('\nConsole problems:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
