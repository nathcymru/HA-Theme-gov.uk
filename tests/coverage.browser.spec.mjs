import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const read = name => JSON.parse(readFileSync(`docs/data/${name}.json`, 'utf8'));
const census = read('ha-interface-coverage');
const terms = read('ha-terminology');
const route = path => `/docs/build${path}`;
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
const openAll = async (page, selector) => {
  // Exercise the semantic disclosure control, including keyboard operation.
  for (const detail of await page.locator(selector).all()) {
    if (await detail.getAttribute('open') !== null) continue;
    await detail.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    await expect(detail).toHaveAttribute('open', '');
  }
};

test('every interface registry remains readable when expanded on a narrow screen', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(route('/home-assistant/interface-coverage.html'));
  await openAll(page, 'details[id^="registry-"]');
  await openAll(page, 'details[id^="registry-"] details');
  await expect(page.locator('tr[id^="coverage-"]')).toHaveCount(census.entries.length);
  await noOverflow(page);
  const first = page.locator('tr[id^="coverage-"]').first();
  await expect(first.getByRole('link', { name: /^Task pattern:/ })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await noOverflow(page);
  const results = await new AxeBuilder({ page }).exclude('iframe').analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
});

for (const path of ['/content/ha-glossary.html', '/content/interface-terminology.html', '/content/entity-and-state-language.html']) {
  test(`${path}: all terminology can be disclosed and read without horizontal page scrolling`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(route(path));
    const expected = terms.terms.filter(term => term.local_path?.split('#')[0] === path);
    await expect(page.locator('details.civica-audit-detail')).toHaveCount(expected.length);
    await openAll(page, 'details.civica-audit-detail');
    await noOverflow(page);
    // Reveal all context-sensitive native labels, including long source pointers.
    if (path.endsWith('entity-and-state-language.html')) {
      await openAll(page, 'details.civica-audit-detail > details');
      await expect(page.locator('tr[id^="ht-native-"]')).toHaveCount(terms.native_values.length);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await noOverflow(page);
    const results = await new AxeBuilder({ page }).exclude('iframe').analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  });
}

test('complete interface and terminology records are linked from the visible audit page', async ({ page, request }) => {
  await page.goto(route('/community/home-assistant-coverage-audit.html'));
  for (const path of ['/home-assistant/interface-coverage.html', '/content/home-assistant-terminology.html', '/community/uk-design-system-review.html', '/components/sliders.html']) {
    const link = page.locator('main a').filter({ hasText: /./ });
    expect(await link.evaluateAll((nodes, suffix) => nodes.some(node => new URL(node.href).pathname.endsWith(suffix)), path)).toBe(true);
    await expect(page.locator(`main a[href$="${path.split('/').pop()}"]`).first()).toBeVisible();
    expect((await request.get(route(path))).ok()).toBe(true);
  }
});
