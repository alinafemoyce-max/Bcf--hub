// Renders the SVG app icon to the PNG sizes iOS and the web manifest need.
// Usage: node scripts/make-icons.mjs   (uses the pre-installed Chromium via playwright-core)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const targets = [
  ['apple-touch-icon.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true]
];
for (const [name, size, maskable] of targets) {
  // iOS adds its own rounded corners, so render a full-bleed square (no transparency).
  const inner = svg.replace(/rx="112"/, 'rx="0"');
  const scale = maskable ? 0.78 : 1;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#0a101c;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * scale}px;height:${size * scale}px">${inner.replace('<svg ', `<svg width="${size * scale}" height="${size * scale}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
