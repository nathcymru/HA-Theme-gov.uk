import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync } from 'node:fs';

function pages(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(`${dir}/${entry.name}`) : entry.name.endsWith('.html') ? [`${dir}/${entry.name}`] : []); }

test('all built documentation pages have accessible structure and fit a narrow screen', async ({ page }) => {
  test.setTimeout(120000);
  const files = pages('docs/build'); expect(files.length).toBeGreaterThanOrEqual(30);
  await page.setViewportSize({width:320,height:800});
  for (const file of files) {
    await page.goto(`/${file}`);
    await expect(page.locator('main h1'), file).toHaveCount(1);
    await expect(page.locator('header img')).toHaveAttribute('alt','civica.uk');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true);
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations, file).toEqual([]);
  }
});

test('documentation works without JavaScript and the skip link reaches the page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/docs/build/index.html');
  await expect(page.locator('main h1')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await context.close();
});
