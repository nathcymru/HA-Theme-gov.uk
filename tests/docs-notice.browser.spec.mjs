import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const NAME = 'civica_docs_notice';
const VALUE = 'v1';
const YEAR = 31536000;
const fallback = 'Notice hidden for this page. Your browser could not save this choice, so the notice may appear again.';
const notice = page => page.locator('[data-site-notice]');
const dismiss = page => page.getByRole('button', { name: 'Hide this notice', exact: true });
const reflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
const errorsOn = page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
};

// Exercise one unchanged Middleman build at both a domain root and the real
// GitHub Pages project prefix. Route fulfilment avoids external network access.
async function mount(page, baseURL, origin = new URL(baseURL).origin, prefix = '') {
  await page.route(`${origin}${prefix}/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice(prefix.length);
    const upstream = new URL(`/docs/build${path}${url.search}`, baseURL).href;
    await route.fulfill({ response: await route.fetch({ url: upstream }) });
  });
  return path => `${origin}${prefix}${path}`;
}

for (const deployment of [
  { name: 'domain root', origin: undefined, prefix: '', secure: false },
  { name: 'HTTPS Pages project', origin: 'https://docs.invalid', prefix: '/civica', secure: true },
]) {
  test(`first acknowledgement is scoped and remembered at the ${deployment.name}`, async ({ page, context, baseURL }) => {
    const url = await mount(page, baseURL, deployment.origin, deployment.prefix);
    const errors = errorsOn(page);
    const mutations = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
    await page.goto(url(deployment.prefix ? '/components/footer.html' : '/index.html'));
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toHaveAttribute('role', 'region');
    await expect(notice(page)).toHaveAccessibleName('About this site and cookies');
    await expect(page.locator('#site-notice-heading')).toHaveText('About this site and cookies');
    await expect(notice(page).getByRole('button')).toHaveCount(1);
    await expect(notice(page).getByRole('button', { name: /accept|reject|consent|preferences/i })).toHaveCount(0);
    await expect(notice(page).locator('input, select, [role="switch"]')).toHaveCount(0);
    expect((await context.cookies()).filter(cookie => cookie.name === NAME)).toEqual([]);
    expect(await notice(page).evaluate(node => node.contains(document.activeElement))).toBe(false);
    const before = Date.now() / 1000;
    await dismiss(page).click();
    await expect(notice(page)).toBeHidden();
    await expect(page.locator('#main-content')).toBeFocused();
    const cookies = (await context.cookies()).filter(cookie => cookie.name === NAME);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ value: VALUE, path: deployment.prefix + '/', sameSite: 'Lax', secure: deployment.secure });
    expect(cookies[0].expires).toBeGreaterThanOrEqual(before + YEAR - 5);
    expect(cookies[0].expires).toBeLessThanOrEqual(Date.now() / 1000 + YEAR + 5);
    await page.reload();
    await expect(notice(page)).toBeHidden();
    await page.goto(url('/index.html'));
    await expect(notice(page)).toBeHidden();
    await page.goto(url('/components/footer.html'));
    await expect(notice(page)).toBeHidden();
    await expect(page.locator('main h1')).toHaveText('Footer');
    if (deployment.prefix) {
      expect((await context.cookies(`${deployment.origin}/elsewhere/`)).filter(cookie => cookie.name === NAME)).toEqual([]);
    }
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('notice dismissal is keyboard reachable, keeps skip navigation first and restores focus to the page', async ({ page, baseURL }) => {
  const url = await mount(page, baseURL);
  await page.goto(url('/index.html'));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused();
  for (let step = 0; step < 12 && !await dismiss(page).evaluate(node => node === document.activeElement); step += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(dismiss(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notice(page)).toBeHidden();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await notice(page).evaluate(node => node.contains(document.activeElement))).toBe(false);
});

for (const mode of ['read throws', 'write throws', 'silent rejection']) {
  test(`unavailable cookie storage (${mode}) remains usable and explains the temporary dismissal`, async ({ page, context, baseURL }) => {
    await context.addInitScript(mode => {
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get() {
          if (mode === 'read throws') throw new DOMException('Blocked by test browser policy', 'SecurityError');
          return descriptor.get.call(this);
        },
        set(value) {
          if (mode === 'write throws') throw new DOMException('Blocked by test browser policy', 'SecurityError');
          if (mode !== 'silent rejection') return descriptor.set.call(this, value);
        },
      });
    }, mode);
    const url = await mount(page, baseURL);
    const errors = errorsOn(page);
    await page.goto(url('/index.html'));
    await expect(notice(page)).toBeVisible();
    await dismiss(page).click();
    await expect(notice(page)).toBeHidden();
    await expect(page.locator('[data-site-notice-status]')).toBeVisible();
    await expect(page.locator('[data-site-notice-status]')).toHaveAttribute('role', 'status');
    await expect(page.locator('[data-site-notice-status]')).toHaveText(fallback);
    await expect(page.locator('#main-content')).toBeFocused();
    expect((await context.cookies()).filter(cookie => cookie.name === NAME)).toEqual([]);
    await page.reload();
    await expect(notice(page)).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('an older acknowledgement is not treated as the current notice and unrelated storage survives', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.addCookies([
    { name: NAME, value: 'v0', url: origin },
    { name: 'unrelated_fixture', value: 'retain', url: origin },
  ]);
  await context.addInitScript(() => localStorage.setItem('unrelated_fixture', 'retain'));
  const url = await mount(page, baseURL);
  await page.goto(url('/index.html'));
  await expect(notice(page)).toBeVisible();
  await dismiss(page).click();
  expect((await context.cookies()).find(cookie => cookie.name === NAME)?.value).toBe(VALUE);
  expect((await context.cookies()).find(cookie => cookie.name === 'unrelated_fixture')?.value).toBe('retain');
  expect(await page.evaluate(() => localStorage.getItem('unrelated_fixture'))).toBe('retain');
});

test('notice and footer remain readable without JavaScript and dismissal does not become a dead control', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  try {
    const url = await mount(page, baseURL);
    await page.goto(url('/index.html'));
    await expect(notice(page)).toBeVisible();
    await expect(dismiss(page)).toBeHidden();
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.c-footer')).toBeVisible();
    expect((await context.cookies()).filter(cookie => cookie.name === NAME)).toEqual([]);
    await reflow(page);
    await page.locator('.c-footer').getByRole('link', { name: /licen[cs]/i }).first().click();
    await expect(page).toHaveURL(/\/community\/licensing\.html$/);
    await expect(page.locator('[data-license-content]')).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await expect(dismiss(page)).toBeHidden();
    await reflow(page);
  } finally { await context.close(); }
});

test('notice is in document flow and remains accessible at 320px with doubled text', async ({ page, baseURL }) => {
  const url = await mount(page, baseURL);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(url('/index.html'));
  const position = await notice(page).evaluate(node => getComputedStyle(node).position);
  expect(['fixed', 'absolute', 'sticky']).not.toContain(position);
  await reflow(page);
  const result = await new AxeBuilder({ page }).exclude('iframe').analyze();
  expect(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-site-notice] h2, [data-site-notice] p, [data-site-notice] a, [data-site-notice] button, .c-footer p, .c-footer li, .c-footer a');
    const sizes = [...nodes].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
  });
  await reflow(page);
  await expect(dismiss(page)).toBeVisible();
  await dismiss(page).click();
  await expect(page.locator('#main-content')).toBeFocused();
  await reflow(page);
});

test('standalone and embedded component examples do not receive the production notice', async ({ page }) => {
  for (const query of ['', '?embed=1']) {
    await page.goto(`/docs/build/examples/core-cookie-choice.html${query}`);
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accept optional measurement', exact: true })).toBeVisible();
    await expect(page.locator('.c-example-notice')).toContainText('actions do not control a home');
  }
});

test('the essential-only component example shares the live markup but never persists an acknowledgement', async ({ page, context }) => {
  const normalized = async locator => locator.evaluate(node => {
    const copy = node.cloneNode(true);
    copy.removeAttribute('data-site-notice');
    copy.removeAttribute('data-docs-home');
    copy.querySelector('[data-site-licence]').setAttribute('href', '/community/licensing.html');
    return copy.outerHTML.replace(/>\s+</g, '><').trim();
  });
  await page.goto('/docs/build/examples/core-cookie-essential.html');
  await expect(notice(page)).toHaveAttribute('data-site-notice', 'example');
  const exampleMarkup = await normalized(notice(page));
  await dismiss(page).click();
  await expect(notice(page)).toBeHidden();
  await expect(page.locator('[data-site-notice-status]')).toHaveText('Example notice hidden. No choice has been stored.');
  expect((await context.cookies()).filter(cookie => cookie.name === NAME)).toEqual([]);
  await page.goto('/docs/build/index.html');
  await expect(notice(page)).toHaveAttribute('data-site-notice', 'live');
  await expect(notice(page)).toBeVisible();
  expect(await normalized(notice(page))).toBe(exampleMarkup);
});

// Render expected terms independently with the same pinned Markdown engine,
// without the site layout. No legal prose is duplicated in this fixture.
test('the public licence block identifies the exact canonical LICENSE.md source', async ({ page }) => {
  const source = readFileSync('LICENSE.md');
  const expectedHtml = execFileSync('bundle', ['exec', 'ruby', '-r', 'redcarpet', '-e', `
    class LicenceRenderer < Redcarpet::Render::HTML
      include Redcarpet::Render::SmartyPants
    end
    print Redcarpet::Markdown.new(LicenceRenderer.new,
      fenced_code_blocks: true, tables: true, no_intra_emphasis: true).render(STDIN.read)
  `], { cwd: 'docs', input: source, encoding: 'utf8', timeout: 20000 });
  await page.goto('/docs/build/community/licensing.html');
  await expect(page.locator('main h1')).toHaveCount(1);
  const content = page.locator('[data-license-content]');
  await expect(content).toBeVisible();
  await expect(content).toHaveAttribute('data-source-sha256', createHash('sha256').update(source).digest('hex'));
  const parity = await content.evaluate((node, expectedHtml) => {
    const actual = node.cloneNode(true);
    actual.querySelectorAll('nav.c-on-this-page').forEach(item => item.remove());
    const expected = new DOMParser().parseFromString(expectedHtml, 'text/html').body;
    const text = element => element.textContent.replace(/\s+/g, ' ').trim();
    const structure = element => [...element.querySelectorAll('h1,h2,h3,h4,p,li,pre,th,td')]
      .map(block => ({ tag: block.tagName, text: text(block) }));
    return { actual: structure(actual), expected: structure(expected) };
  }, expectedHtml);
  expect(parity.actual).toEqual(parity.expected);
  await expect(page.locator('.c-contribute').getByRole('link', { name: 'View this page’s source', exact: true }))
    .toHaveAttribute('href', 'https://github.com/nathcymru/civica/blob/main/LICENSE.md');
  const footer = page.locator('.c-footer');
  await expect(footer).toContainText('civica is independent of the UK Government');
  await expect(footer).toContainText('GOV.UK Frontend components');
  for (const label of ['Licence', 'Licence and attribution']) {
    const href = await footer.getByRole('link', { name: label, exact: true }).getAttribute('href');
    expect(new URL(href, page.url()).pathname).toBe('/docs/build/community/licensing.html');
  }
  await expect(footer.locator('img')).toHaveAttribute('alt', '');
});
