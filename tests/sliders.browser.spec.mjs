import { test, expect } from '@playwright/test';

const example = id => `/docs/build/examples/${id}.html`;
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('slider, exact field and steps share a decimal draft while the reported temperature stays separate', async ({ page }) => {
  await page.goto(example('slider-temperature'));
  const range = page.getByRole('slider', { name: 'Target temperature slider (degrees Celsius)' });
  const field = page.getByLabel('Exact target temperature (degrees Celsius)', { exact: true });
  await field.fill('20.5');
  await expect(range).toHaveValue('20.5');
  await expect(range).toHaveAttribute('aria-valuetext', '20.5 degrees Celsius');
  await page.getByRole('button', { name: 'Increase target temperature by 0.5 degrees Celsius' }).click();
  await expect(field).toHaveValue('21');
  await range.focus(); await page.keyboard.press('ArrowLeft');
  await expect(field).toHaveValue('20.5');
  await page.keyboard.press('Home'); await expect(field).toHaveValue('16');
  await expect(page.getByRole('button', { name: 'Decrease target temperature by 0.5 degrees Celsius' })).toBeDisabled();
  await page.keyboard.press('End'); await expect(field).toHaveValue('28');
  await expect(page.getByRole('button', { name: 'Increase target temperature by 0.5 degrees Celsius' })).toBeDisabled();
  await expect(page.locator('.c-example-canvas strong')).toHaveText('19.5 °C');
  await page.getByRole('button', { name: 'Preview target temperature request' }).click();
  await expect(page.locator('[data-demo-status]')).toContainText('28 °C accepted locally');
  await expect(page.locator('.c-example-canvas strong')).toHaveText('19.5 °C');
});

test('invalid exact values retain the draft text and last valid thumb, with no accepted outcome', async ({ page }) => {
  await page.goto(example('slider-temperature'));
  const field = page.getByLabel('Exact target temperature (degrees Celsius)', { exact: true });
  const range = page.getByRole('slider');
  for (const value of ['', 'twenty', '29', '20.2', '0x14', '2e1']) {
    await field.fill(value);
    await page.getByRole('button', { name: 'Preview target temperature request' }).click();
    await expect(field).toHaveValue(value);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    await expect(page.locator('[data-slider-error]')).toBeVisible();
    await expect(page.locator('[data-demo-status]')).toBeEmpty();
    await expect(range).toHaveValue('20');
    await expect(page.locator('[data-slider-output]')).toHaveText('Enter a valid draft value.');
  }
  await field.fill('20.5');
  await expect(page.locator('[data-slider-error]')).toBeHidden();
  await expect(field).toHaveAttribute('aria-invalid', 'false');
  await expect(range).toHaveValue('20.5');
});

test('a keyboard step to either endpoint preserves focus on the exact-value field', async ({ page }) => {
  await page.goto(example('slider-brightness'));
  const field = page.getByLabel('Exact brightness (per cent)', { exact: true });
  await field.fill('99');
  const increase = page.getByRole('button', { name: 'Increase brightness by 1 per cent' });
  await increase.focus(); await page.keyboard.press('Enter');
  await expect(increase).toBeDisabled(); await expect(field).toBeFocused(); await expect(field).toHaveValue('100');
  await field.fill('2');
  const decrease = page.getByRole('button', { name: 'Decrease brightness by 1 per cent' });
  await decrease.focus(); await page.keyboard.press('Space');
  await expect(decrease).toBeDisabled(); await expect(field).toBeFocused(); await expect(field).toHaveValue('1');
});

test('signed values and zero remain usable with exact entry and keyboard endpoints', async ({ page }) => {
  await page.goto(example('slider-signed-offset'));
  const field = page.getByLabel('Exact offset (degrees Celsius)', { exact: true });
  await expect(field).not.toHaveAttribute('inputmode', 'decimal');
  await field.fill('-2.5');
  await expect(page.getByRole('slider')).toHaveValue('-2.5');
  await page.getByRole('button', { name: 'Increase offset by 0.5 degrees Celsius' }).click();
  await expect(field).toHaveValue('-2');
  await field.fill('0'); await expect(page.locator('[data-slider-output]')).toHaveText('0 °C');
  await page.getByRole('slider').focus(); await page.keyboard.press('Home');
  await expect(field).toHaveValue('-5');
  await page.keyboard.press('End'); await expect(field).toHaveValue('5');
});

test('failed slider requests retain their draft and report without sending network mutations', async ({ page }) => {
  const mutations = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(example('slider-request-failed'));
  await page.getByRole('button', { name: 'Preview volume request' }).click();
  await expect(page.locator('[data-demo-status]')).toContainText('Example request failed. The 40% draft is retained.');
  await expect(page.locator('.c-example-canvas strong')).toHaveText('25%');
  await expect(page.getByRole('slider')).toHaveValue('40');
  await page.getByLabel('Exact volume (per cent)', { exact: true }).fill('45');
  await expect(page.locator('[data-demo-status]')).toBeEmpty();
  expect(mutations).toEqual([]);
});

test('unavailable slider has no invented numeric position and a useful explanation', async ({ page }) => {
  await page.goto(example('slider-unavailable'));
  await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change volume' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Change volume' })).toHaveAttribute('aria-describedby', 'slider-unavailable-reason');
  await page.getByText('Connection details', { exact: true }).click();
  await expect(page.getByText('Unavailable is not zero or muted.', { exact: false })).toBeVisible();
});

test('slider controls are disabled without script while their content and reported value remain available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173${example('slider-brightness')}`);
  for (const control of await page.locator('form input, form button').all()) await expect(control).toBeDisabled();
  expect(await page.locator('noscript').textContent()).toContain('No data is submitted');
  await expect(page.locator('noscript')).toBeVisible();
  await expect(page.locator('.c-example-canvas strong')).toHaveText('40%');
  await noOverflow(page); await context.close();
});

test('slider alternatives wrap at 200% text and keep native semantics and visible focus in forced colours', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(example('slider-temperature'));
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await noOverflow(page);
  await expect(page.locator('[data-slider-output]')).toHaveAttribute('aria-live', 'off');
  const range = page.getByRole('slider');
  expect(await range.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.emulateMedia({ forcedColors: 'active' });
  await range.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Exact target temperature (degrees Celsius)', { exact: true })).toHaveValue('20.5');
  expect(await range.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  expect(await range.evaluate(node => getComputedStyle(node).forcedColorAdjust)).toBe('auto');
  await noOverflow(page);
});
