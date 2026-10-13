// Run from the woodmillflow folder:  node hosted/tests/workflow.test.mjs
// Drives the hosted page in Chromium with two separate browser sessions sharing one stand-in
// database whose documents are frozen, like the real artifact database.
// End-to-end test of the hosted page with two SEPARATE browser sessions sharing one store.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const htmlPath = process.argv[2] || new URL('../woodmill-orders.html', import.meta.url).pathname;
const outDir = process.argv[3] || fs.mkdtempSync('/tmp/woodmill-shots-');
let page = fs.readFileSync(htmlPath, 'utf8');
const mock = fs.readFileSync(new URL('./mock-db.js', import.meta.url), 'utf8');
const doc = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style><script>${mock}</script></head><body>${page}</body></html>`;
const qrjs = fs.readFileSync(new URL('./qrcode.min.js', import.meta.url), 'utf8');

// The shared store, plus a switch to make the next write fail (network failure simulation).
const store = new Map();
let failWrites = 0;
const seed = JSON.parse(fs.readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
for (const [k, v] of Object.entries(seed)) store.set(k, v);
function dbOp(b) {
  if (b.op === 'list') return [...store.entries()].filter(([k]) => k.startsWith(b.coll + '/') && k.split('/').length === 2).map(([k, v]) => ({ id: k.split('/')[1], data: v }));
  if (b.op === 'get') return store.get(b.path) ?? null;
  if (['set', 'update', 'delete'].includes(b.op) && failWrites > 0) { failWrites--; throw { code: 'unavailable', message: 'simulated network failure' }; }
  if (b.op === 'set') { store.set(b.path, b.data); return null; }
  if (b.op === 'update') { if (!store.has(b.path)) throw { code: 'invalid_argument', message: 'missing' }; store.set(b.path, { ...store.get(b.path), ...b.data }); return null; }
  if (b.op === 'delete') { store.delete(b.path); return null; }
}
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); } };

const b = await chromium.launch();
async function session(viewport, mobile) {
  const ctx = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/London' });
  await ctx.route('**/*', async (r) => {
    const u = r.request().url();
    if (u.startsWith('http://app.test/__db')) {
      try { return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: dbOp(JSON.parse(r.request().postData())) }) }); }
      catch (e) { return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ error: e }) }); }
    }
    if (u.startsWith('http://app.test/')) return r.fulfill({ contentType: 'text/html', body: doc });
    if (u.includes('qrcode.min.js')) return r.fulfill({ contentType: 'application/javascript', body: qrjs });
    return r.abort();
  });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push('console: ' + m.text()); });
  return p;
}
const phone = await session({ width: 390, height: 844 }, true);   // employee (iPhone-sized)
const mill = await session({ width: 1280, height: 900 }, false);  // operator (separate session)
const T = { timeout: 6000 };
let ref1, ref2;

await step('employee places plywood order', async () => {
  await phone.goto('http://app.test/#order');
  await phone.fill('#f-clock', '990011');
  await phone.fill('#f-name', 'Test Employee');
  await phone.selectOption('#f-dept', 'Shed 2');
  await phone.click('[data-act="step1"]');
  await phone.click('.mat-card.plywood');
  await phone.selectOption('#f-spec', 'Birch plywood');
  await phone.click('[data-act="thick"][data-v="18"]');
  await phone.fill('#f-len', '800'); await phone.fill('#f-wid', '400'); await phone.fill('#f-qty', '3');
  await phone.fill('#f-notes', 'Test order 1 - grain lengthways');
  await phone.click('[data-act="step3"]');
  // Double tap on submit must not create two orders.
  await phone.locator('[data-act="submit"]').dblclick();
  await phone.waitForSelector('#done-ref', T);
  ref1 = (await phone.locator('#done-ref').innerText()).trim();
  check('1. order submitted, confirmation shows reference', /^WM-\d{5}$/.test(ref1), ref1);
});
check('2. order saved in shared store with all fields', (() => {
  const o = store.get('orders/' + ref1);
  return o && o.clock === '990011' && o.cat === 'plywood' && o.spec === 'Birch plywood' && o.thick === 18 && o.len === 800 && o.wid === 400 && o.qty === 3 && o.notes === 'Test order 1 - grain lengthways' && o.status === 'pending' && !!o.createdAt;
})());
check('3. double tap created exactly one order', [...store.values()].filter(o => o.clock === '990011').length === 1);

await step('4. order appears in My Orders', async () => {
  await phone.click('[data-act="view-mine"]');
  await phone.click('[data-act="close-detail"]');
  await phone.waitForSelector(`.order-card[data-ref="${ref1}"]`, T);
  const txt = await phone.locator(`.order-card[data-ref="${ref1}"]`).innerText();
  check('4. order appears in My Orders with material, qty, status', txt.includes('Plywood') && txt.includes('3 ×') && txt.includes('Pending'));
});
await step('5. order appears on operator dashboard (separate session)', async () => {
  await mill.goto('http://app.test/#mill');
  await mill.click('[data-act="operator-on"]');
  await mill.waitForSelector(`article.job[data-ref="${ref1}"]`, T);
  const t = await mill.locator(`article.job[data-ref="${ref1}"]`).innerText();
  check('5. same order on operator dashboard with clock, sizes, qty, time', ['990011', '800', '400', '18', 'Birch plywood', 'Pending'].every(s => t.includes(s)));
});
await step('6-7. In Progress reflected for employee', async () => {
  await mill.locator(`article.job[data-ref="${ref1}"] [data-act="advance"]`).click();
  await mill.waitForSelector(`article.job[data-ref="${ref1}"][data-status="in_progress"]`, T);
  await phone.waitForFunction((r) => document.querySelector(`.order-card[data-ref="${r}"]`)?.innerText.includes('In Progress'), ref1, T);
  check('6-7. status In Progress shows in My Orders', true);
});
await step('8-9. Ready for Collection in both views', async () => {
  await mill.locator(`article.job[data-ref="${ref1}"] [data-act="advance"]`).click();
  await mill.waitForSelector(`article.job[data-ref="${ref1}"][data-status="ready"]`, T);
  await phone.waitForFunction((r) => document.querySelector(`.order-card[data-ref="${r}"]`)?.innerText.includes('Ready for Collection'), ref1, T);
  check('8-9. Ready for Collection shows in both views', true);
});
await step('10. refresh both pages, data persists', async () => {
  await phone.reload(); await mill.reload();
  await phone.click('.tab[data-go="mine"]');
  await phone.waitForSelector(`.order-card[data-ref="${ref1}"]`, T);
  await mill.waitForSelector(`article.job[data-ref="${ref1}"][data-status="ready"]`, T);
  check('10. after refresh order + status remain in both views', (await phone.locator(`.order-card[data-ref="${ref1}"]`).innerText()).includes('Ready for Collection'));
});
await step('11. second order does not overwrite the first', async () => {
  await phone.click('.tab[data-go="order"]');
  await phone.click('[data-act="step1"]');
  await phone.click('.mat-card.mdf');
  await phone.selectOption('#f-spec', 'Moisture-resistant MDF');
  await phone.fill('#f-thick', '12'); await phone.fill('#f-len', '600'); await phone.fill('#f-wid', '250'); await phone.fill('#f-qty', '2');
  await phone.click('[data-act="step3"]');
  await phone.click('[data-act="submit"]');
  await phone.waitForSelector('#done-ref', T);
  ref2 = (await phone.locator('#done-ref').innerText()).trim();
  const mine = [...store.values()].filter(o => o.clock === '990011');
  check('11. second order saved separately; first unchanged', ref2 !== ref1 && mine.length === 2 && store.get('orders/' + ref1).status === 'ready' && store.get('orders/' + ref1).len === 800);
  await phone.click('[data-act="view-mine"]'); await phone.click('[data-act="close-detail"]');
  await phone.waitForSelector(`.order-card[data-ref="${ref2}"]`, T);
  const refs = await phone.locator('.order-card').evaluateAll(els => els.map(e => e.dataset.ref));
  check('11b. My Orders lists both, newest first', refs[0] === ref2 && refs.includes(ref1), refs.join(','));
  await mill.waitForSelector(`article.job[data-ref="${ref2}"][data-status="pending"]`, T);
  check('11c. new pending order shown on dashboard without restart', true);
});
await step('12. completed status', async () => {
  await mill.locator(`article.job[data-ref="${ref1}"] [data-act="advance"]`).click();
  await mill.click('[data-act="filter"][data-v="collected"]');
  await mill.waitForSelector(`article.job[data-ref="${ref1}"][data-status="collected"]`, T);
  await phone.waitForFunction((r) => document.querySelector(`.order-card[data-ref="${r}"]`)?.innerText.includes('Completed'), ref1, T);
  check('12. Completed shows in both views', true);
});
await step('13. order detail opens with full specification', async () => {
  await phone.click(`.order-card[data-ref="${ref2}"]`);
  const t = await phone.locator('main').innerText();
  check('13. employee order detail shows full spec', ['Moisture-resistant MDF', '600', '250', '12', 'Pending'].every(s => t.includes(s)));
  await phone.click('[data-act="close-detail"]');
});
await step('14. save failure shows error, keeps data, retry works', async () => {
  await phone.click('.tab[data-go="order"]');
  await phone.click('[data-act="step1"]');
  await phone.click('.mat-card.timber');
  await phone.selectOption('#f-spec', 'Oak');
  await phone.fill('#f-thick', '27'); await phone.fill('#f-len', '2100'); await phone.fill('#f-wid', '140'); await phone.fill('#f-qty', '6');
  await phone.click('[data-act="step3"]');
  failWrites = 2; // first try and its automatic retry both fail
  await phone.click('[data-act="submit"]');
  await phone.waitForSelector('.banner-error', T);
  check('14. failed save shows error and no confirmation', (await phone.locator('#done-ref').count()) === 0 && (await phone.locator('.banner-error').innerText()).includes('NOT been sent'));
  check('14b. technical error logged to console', phone.errors.some(e => e.includes('[woodmill]')));
  await phone.click('[data-act="submit"]');
  await phone.waitForSelector('#done-ref', T);
  check('14c. retry succeeds with entered details kept', [...store.values()].filter(o => o.clock === '990011').length === 3);
});
await step('15. new employee with no orders', async () => {
  const fresh = await session({ width: 375, height: 800 }, true);
  await fresh.goto('http://app.test/#mine');
  await fresh.fill('#f-mine', '55550000'); await fresh.click('.searchbar button');
  await fresh.waitForSelector('.empty', T);
  await fresh.waitForFunction(() => document.querySelector('.empty')?.innerText.includes('placed any orders'), null, T).catch(() => {});
  const emptyText = await fresh.locator('.empty').innerText();
  check('15. empty My Orders message', emptyText.includes("You haven't placed any orders yet"), emptyText.replace(/\n/g, ' '));
});
for (const w of [320, 375, 390, 430]) {
  await phone.setViewportSize({ width: w, height: 800 });
  for (const v of ['home', 'order', 'mine', 'mill']) {
    await phone.goto(`http://app.test/#${v}`); await phone.waitForTimeout(500);
    const [sw, iw] = await phone.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (sw > iw) check(`no overflow ${v} @${w}`, false, `${sw}>${iw}`);
  }
}
check('16. no horizontal overflow at 320/375/390/430', !results.some(r => r.startsWith('FAIL no overflow')));
const unexpected = [...phone.errors, ...mill.errors].filter(e => !e.includes('[woodmill]') && !e.includes('Failed to load resource'));
check('17. no unexpected page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
await phone.setViewportSize({ width: 390, height: 844 });
await phone.goto('http://app.test/#mine'); await phone.waitForTimeout(600);
await phone.screenshot({ path: `${outDir}/fix-mine-390.png`, fullPage: true });
await mill.screenshot({ path: `${outDir}/fix-mill-1280.png` });
console.log(results.join('\n'));
await b.close();
