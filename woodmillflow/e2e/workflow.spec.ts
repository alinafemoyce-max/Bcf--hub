import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, fillItem, newLaptop, newPhone, ukToday } from './helpers';

test.beforeAll(async ({ request }) => {
  const pin = process.env.E2E_DATABASE_URL ? (process.env.E2E_RESET_PIN ?? 'e2e-pin') : undefined;
  const res = await request.post('/api/demo/reset', { data: { confirm: 'RESET', pin } });
  expect(res.ok()).toBeTruthy();
});

test('complete workflow: iPhone employee and laptop operator share the same orders', async ({ browser }) => {
  const phone = await newPhone(browser);
  const laptop = await newLaptop(browser);

  // 1. Employee opens the portal on the phone.
  await phone.goto('/');
  await phone.getByTestId('enter-employee').click();
  await expect(phone).toHaveURL(/\/request$/);
  await expect(phone.getByRole('heading', { name: 'New Woodmill Request' })).toBeVisible();

  // 2. Employee information (fictional clock number).
  await phone.getByLabel('Clock number').fill('246810');
  await phone.getByLabel('Employee name').fill('Casey Lane');
  await phone.getByLabel('Department / shed').selectOption({ label: 'Shed 2' });
  await phone.getByLabel('Production line').selectOption({ label: 'Manhattan 68' });
  await phone.getByLabel('Boat / hull reference').fill('M68-DEMO-21');

  // 3. Two different cutting items.
  await fillItem(phone, 0, { category: 'Plywood', description: 'Birch plywood', thickness: '18', length: '800', width: '400', quantity: '3' });
  await phone.getByTestId('add-item').click();
  await fillItem(phone, 1, {
    category: 'MDF', description: 'Moisture-resistant MDF', thickness: '12', length: '600', width: '250', quantity: '2', extra: ['Drilling']
  });
  await phone.getByLabel('Additional instructions').fill('Please confirm the dimensions before cutting.');
  await expect(phone.getByTestId('item-count')).toHaveText('2 items · 5 pieces');
  await expectNoHorizontalOverflow(phone);

  // 4. Review and submit.
  await phone.getByTestId('review-request').click();
  await expect(phone.getByText('Check your request')).toBeVisible();
  await expect(phone.getByTestId('item-spec')).toHaveCount(2);
  await phone.getByTestId('submit-request').click();

  // 5. Reference, date and time are generated and shown.
  await expect(phone.getByTestId('submission-success')).toBeVisible();
  const reference = (await phone.getByTestId('order-reference').innerText()).trim();
  expect(reference).toMatch(/^WM-\d{4}-\d{4}$/);
  await expect(phone.getByTestId('submitted-date')).toHaveText(ukToday());
  await expect(phone.getByTestId('submitted-time')).toHaveText(/^\d{2}:\d{2}$/);
  const trackingUrl = (await phone.getByTestId('tracking-url').innerText()).trim();
  expect(trackingUrl).toMatch(/\/track\/[A-Za-z0-9_-]{32,}$/);
  expect(trackingUrl).not.toContain(reference);

  // 6–7. Operator opens the dashboard on the laptop and finds the request.
  await laptop.goto('/');
  await laptop.getByTestId('enter-operator').click();
  await expect(laptop).toHaveURL(/\/operator/);
  const card = laptop.locator(`[data-testid="queue-item"][data-reference="${reference}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Casey Lane');
  await expect(card).toContainText('246810');
  await card.getByRole('button').click();
  const detail = laptop.getByTestId('order-detail');
  await expect(detail.getByTestId('detail-reference')).toHaveText(reference);
  await expect(detail.getByTestId('detail-clock')).toHaveText('246810');
  await expect(detail).toContainText('Manhattan 68');
  await expect(detail.getByTestId('item-spec')).toHaveCount(2);
  await expect(detail.getByTestId('item-spec').first()).toContainText('Birch plywood');
  await expect(detail.getByTestId('item-spec').first()).toContainText('800');
  await expect(detail.getByTestId('item-spec').nth(1)).toContainText('Drilling');

  // 8–10. Accept → In Progress → Ready for Collection.
  await detail.getByTestId('action-accepted').click();
  await expect(detail).toHaveAttribute('data-order-status', 'accepted');
  await detail.getByTestId('action-in_progress').click();
  await expect(detail).toHaveAttribute('data-order-status', 'in_progress');
  await detail.getByTestId('action-ready').click();
  await expect(detail).toHaveAttribute('data-order-status', 'ready');

  // 11–12. Employee tracking page shows the update.
  await phone.getByTestId('track-request').click();
  await expect(phone.getByTestId('tracking-reference')).toHaveText(reference);
  await expect(phone.getByTestId('tracking-status-text')).toContainText('Ready for Collection');
  await expect(phone.getByTestId('ready-banner')).toBeVisible();
  await expect(phone.locator('[data-step="in_progress"]')).toHaveAttribute('data-state', 'done');
  await expect(phone.locator('[data-step="ready"]')).toHaveAttribute('data-state', 'current');
  await expectNoHorizontalOverflow(phone);

  // 13. Operator marks the job collected (with confirmation).
  await detail.getByTestId('action-collected').click();
  await laptop.getByTestId('dialog-confirm').click();
  await expect(detail).toHaveAttribute('data-order-status', 'collected');

  // Tracking page picks up the change automatically (polling).
  await expect(phone.getByTestId('tracking-status-text')).toContainText('Collected', { timeout: 15_000 });

  // 14. Refresh both and confirm the data persisted on the server.
  await phone.reload();
  await expect(phone.getByTestId('tracking-status-text')).toContainText('Collected');
  await expect(phone.locator('[data-step="collected"]')).toHaveAttribute('data-state', 'done');
  await laptop.reload();
  await laptop.getByRole('tab', { name: 'Completed' }).click();
  const done = laptop.locator(`[data-testid="queue-item"][data-reference="${reference}"]`);
  await expect(done).toHaveAttribute('data-status', 'collected');
  await done.getByRole('button').click();
  await expect(laptop.getByTestId('history')).toContainText('Ready for Collection');
  await expect(laptop.getByTestId('history')).toContainText('Sam Morgan');

  // The phone's "My requests" list includes the order.
  await phone.goto('/requests');
  await expect(phone.getByTestId('my-requests')).toContainText(reference);
});

test('the request form explains what is missing', async ({ browser }) => {
  const phone = await newPhone(browser);
  await phone.goto('/request');
  await phone.getByTestId('review-request').click();
  await expect(phone.getByText('Enter your clock number')).toBeVisible();
  await expect(phone.getByText('Enter your name')).toBeVisible();
  await expect(phone.getByText('Choose your department or shed')).toBeVisible();
  await expect(phone.getByText('Choose a material category', { exact: true })).toBeVisible();
  await phone.getByLabel('Clock number').fill('12');
  await expect(phone.getByText(/Clock number must be 4–8 digits/)).toBeVisible();
  await phone.getByTestId('item-0').getByRole('radio', { name: 'Plywood', exact: true }).click();
  await phone.getByTestId('item-0').getByLabel('Length', { exact: true }).fill('0');
  await expect(phone.getByText('Length must be at least 1 mm')).toBeVisible();
  // Nothing was submitted.
  await expect(phone.getByTestId('submission-success')).toHaveCount(0);
});

test('items can be duplicated and removed independently', async ({ browser }) => {
  const phone = await newPhone(browser);
  await phone.goto('/request');
  await fillItem(phone, 0, { category: 'Hardwood', description: 'Oak', thickness: '27', length: '2100', width: '140', quantity: '6' });
  await phone.getByTestId('item-0').getByRole('button', { name: 'Duplicate item 1' }).click();
  await expect(phone.getByTestId('item-1').getByLabel('Length', { exact: true })).toHaveValue('2100');
  await phone.getByTestId('item-1').getByLabel('Length', { exact: true }).fill('1800');
  await expect(phone.getByTestId('item-0').getByLabel('Length', { exact: true })).toHaveValue('2100');
  await expect(phone.getByTestId('item-count')).toHaveText('2 items · 12 pieces');
  await phone.getByTestId('item-0').getByRole('button', { name: 'Remove item 1' }).click();
  await expect(phone.getByTestId('item-0').getByLabel('Length', { exact: true })).toHaveValue('1800');
  await expect(phone.getByTestId('item-count')).toHaveText('1 item · 6 pieces');
});
