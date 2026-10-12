import { expect, type Browser, type Page } from '@playwright/test';

export const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
};

export const LAPTOP = { viewport: { width: 1440, height: 900 } };

export async function newPhone(browser: Browser, width = 390) {
  const ctx = await browser.newContext({ ...IPHONE, viewport: { width, height: 844 }, locale: 'en-GB', timezoneId: 'Europe/London' });
  return ctx.newPage();
}

export async function newLaptop(browser: Browser) {
  const ctx = await browser.newContext({ ...LAPTOP, locale: 'en-GB', timezoneId: 'Europe/London' });
  return ctx.newPage();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(inner);
}

export function ukToday() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

/** Fills one cutting item on the request form. */
export async function fillItem(
  page: Page,
  index: number,
  item: { category: string; description: string; thickness: string; length: string; width: string; quantity: string; extra?: string[] }
) {
  const card = page.getByTestId(`item-${index}`);
  await card.getByRole('radio', { name: item.category, exact: true }).click();
  await card.getByLabel('Material description').selectOption(item.description);
  await card.getByLabel('Thickness', { exact: true }).fill(item.thickness);
  await card.getByLabel('Length', { exact: true }).fill(item.length);
  await card.getByLabel('Width', { exact: true }).fill(item.width);
  await card.getByLabel('Quantity', { exact: true }).fill(item.quantity);
  for (const x of item.extra ?? []) await card.getByRole('checkbox', { name: x }).click();
}
