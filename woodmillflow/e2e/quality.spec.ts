import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expectNoHorizontalOverflow, newPhone } from './helpers';

test('QR code decodes to the employee request form address', async ({ browser }) => {
  const phone = await newPhone(browser);
  await phone.goto('/qr');
  const url = (await phone.getByTestId('order-url').innerText()).trim();
  expect(url).toMatch(/^https?:\/\/[^/]+\/request$/);
  expect(url).not.toContain('localhost');
  const src = await phone.getByTestId('qr-image').getAttribute('src');
  const png = PNG.sync.read(Buffer.from(src!.split(',')[1], 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(url);
  // The decoded address really serves the request form.
  const res = await phone.request.get(new URL(url).pathname);
  expect(res.status()).toBe(200);
});

for (const width of [375, 390, 430]) {
  test(`no horizontal overflow at ${width}px on every screen`, async ({ browser }) => {
    const phone = await newPhone(browser, width);
    const pages = ['/', '/request', '/requests', '/qr', '/poster', '/guide', '/demo'];
    for (const path of pages) {
      await phone.goto(path);
      await phone.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(phone);
    }
    await phone.goto('/demo');
    await phone.getByTestId('mobile-menu').click();
    await phone.getByRole('dialog').getByTestId('role-operator').click();
    await expect(phone).toHaveURL(/\/operator/);
    await expect(phone.getByTestId('queue-item').first()).toBeVisible();
    await expectNoHorizontalOverflow(phone);
    await phone.getByTestId('queue-item').first().getByRole('link').click();
    await expect(phone.getByTestId('order-detail')).toBeVisible();
    await expectNoHorizontalOverflow(phone);
  });
}

test('operator API refuses requests without the operator role', async ({ request }) => {
  const res = await request.get('/api/orders', { headers: { cookie: 'wf_role=employee' } });
  expect(res.status()).toBe(403);
});

test('tracking links cannot be guessed from order references', async ({ request, browser }) => {
  expect((await request.get('/api/track/WM-2026-0018')).status()).toBe(404);
  const phone = await newPhone(browser);
  await phone.goto('/track/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await expect(phone.getByText('Order not found')).toBeVisible();
});

test('cross-site form posts are rejected', async ({ request }) => {
  const res = await request.post('/api/orders', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: 'a=b'
  });
  expect(res.status()).toBe(415);
});
