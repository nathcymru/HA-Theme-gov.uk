import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const links = [
  { name: 'Housework', path: '/dashboard-housework/home' },
  { name: 'Lights', path: '#lights' },
  { name: 'Heating and hot water', path: '#heating' },
];

async function mount(page, config = { links }) {
  await page.goto('/ui/dev/');
  await page.waitForFunction(() => window.fixture && customElements.get('civica-action-links'));
  await page.evaluate(config => {
    const card = document.createElement('civica-action-links');
    card.setConfig(config); document.querySelector('main').prepend(card);
    window.actionLinks = card;
  }, config);
}

test('action links have meaningful names, SVG decoration, native targets and mobile reflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mount(page);
  const card = page.locator('civica-action-links');
  await expect(card.getByRole('list')).toHaveCount(1);
  await expect(card.getByRole('link')).toHaveCount(3);
  for (const { name, path } of links) {
    const link = card.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', path);
    expect(await link.getAttribute('target')).toBeNull();
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(await link.evaluate(el => getComputedStyle(el).fontSize)).toBe('19px');
    expect(await link.locator('.label').evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('underline');
    await expect(link.locator('.circle')).toHaveAttribute('aria-hidden', 'true');
    await expect(link.locator('svg')).toHaveAttribute('focusable', 'false');
    await expect(link.locator('svg path')).toHaveAttribute('stroke-width', '2');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const positions = await card.getByRole('link').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  expect(new Set(positions).size).toBeGreaterThan(1);
  expect(await card.evaluate(el => getComputedStyle(el).borderStyle)).toBe('none');
  expect((await new AxeBuilder({ page }).include('civica-action-links').analyze()).violations).toEqual([]);
});

test('rejects nonlocal and ambiguous destinations without replacing valid links, and treats names as text', async ({ page }) => {
  await mount(page);
  const invalid = [
    '', '#', 'dashboard-housework/home', 'https://example.com/', '//example.com/',
    '/\\example.com/', '\\example.com/', 'javascript:alert(1)', 'data:text/html,test',
    '/path with spaces', '/path\n', '\t//example.com/', null, 42,
  ];
  const messages = await page.evaluate(paths => paths.map(path => {
    try { window.actionLinks.setConfig({ links: [{ name: 'Unsafe', path }] }); return null; }
    catch (error) { return error.message; }
  }), invalid);
  expect(messages.every(message => typeof message === 'string' && message.includes('local path'))).toBe(true);
  await expect(page.locator('civica-action-links').getByRole('link')).toHaveCount(3);
  const missing = await page.evaluate(() => [null, {}, { links: [] }, { links: [{ name: ' ', path: '/' }] }].map(config => {
    try { window.actionLinks.setConfig(config); return false; } catch { return true; }
  }));
  expect(missing).toEqual([true, true, true, true]);
  await page.evaluate(() => window.actionLinks.setConfig({ links: [{ name: '<img src=x onerror=alert(1)>', path: '/config' }] }));
  await expect(page.locator('civica-action-links').getByRole('link', { name: '<img src=x onerror=alert(1)>', exact: true })).toBeVisible();
  await expect(page.locator('civica-action-links img')).toHaveCount(0);
});

test('keyboard activation preserves native hash navigation, back history and same-tab page navigation', async ({ page }) => {
  await mount(page, { links: [{ name: 'Lights', path: '#lights' }, { name: 'Lighting preview', path: '/card/dev/' }] });
  await page.evaluate(() => {
    window.hashEvents = [];
    window.addEventListener('hashchange', () => window.hashEvents.push(location.hash));
    document.querySelector('main').setAttribute('data-same-document', 'yes');
  });
  const lights = page.getByRole('link', { name: 'Lights', exact: true });
  await page.keyboard.press('Tab');
  await expect(lights).toBeFocused();
  await lights.hover();
  expect(await lights.evaluate(el => getComputedStyle(el).color)).toBe('rgb(11, 12, 12)');
  expect(await lights.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#lights$/);
  await expect.poll(() => page.evaluate(() => window.hashEvents)).toEqual(['#lights']);
  await expect(page.locator('main')).toHaveAttribute('data-same-document', 'yes');
  await page.goBack();
  await expect(page).toHaveURL(/\/ui\/dev\/$/);
  await expect(page.locator('main')).toHaveAttribute('data-same-document', 'yes');
  await page.getByRole('link', { name: 'Lighting preview', exact: true }).click();
  await expect(page).toHaveURL(/\/card\/dev\/$/);
  await expect(page.getByRole('heading', { name: 'House lighting', exact: true })).toBeVisible();
});

test('all 20 palettes in both modes keep link and circle-arrow contrast, including keyboard focus', async ({ page }) => {
  await mount(page);
  const measurements = await page.evaluate(() => {
    const link = window.actionLinks.shadowRoot.querySelector('a');
    const circle = link.querySelector('.circle');
    const ratio = (one, two) => {
      const luminance = colour => colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => {
        const c = n / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
      const [a, b] = [luminance(one), luminance(two)];
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const out = [];
    for (const theme of Object.keys(window.fixture.themes)) for (const dark of [false, true]) {
      window.fixture.app.hass.selectedTheme = { theme, dark }; window.fixture.paint();
      const c = getComputedStyle(circle);
      const a = getComputedStyle(link);
      out.push({ theme, dark, label: ratio(a.color, getComputedStyle(document.body).backgroundColor), arrow: ratio(c.color, c.backgroundColor) });
    }
    return out;
  });
  expect(measurements).toHaveLength(40);
  for (const state of measurements) {
    expect(state.label, `${state.theme} ${state.dark ? 'dark' : 'light'} text`).toBeGreaterThanOrEqual(4.5);
    expect(state.arrow, `${state.theme} ${state.dark ? 'dark' : 'light'} arrow`).toBeGreaterThanOrEqual(3);
  }
  const link = page.locator('civica-action-links a').first();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  await link.hover();
  expect(await link.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 221, 0)');
  expect(await link.locator('.circle').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 221, 0)');
  expect(await link.locator('.circle').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 12, 12)');
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
});
