// Renders public/icons/icon.svg to the PNG sizes iOS and the web manifest need.
// Usage: node scripts/make-icons.mjs  (uses the Chromium that playwright-core can find)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const targets = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.8]
];
for (const [name, size, scale] of targets) {
  // iOS rounds the corners itself, so render full-bleed squares.
  const inner = svg.replace('rx="112"', 'rx="0"').replace('<svg ', `<svg width="${size * scale}" height="${size * scale}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#0b0c0f;display:grid;place-items:center;width:${size}px;height:${size}px">${inner}</body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname });
  console.log('wrote', name);
}
await browser.close();
