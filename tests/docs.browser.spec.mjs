import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import YAML from 'yaml';

const buildRoot = 'docs/build';
function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? pages(`${dir}/${entry.name}`)
    : entry.name.endsWith('.html') ? [`${dir}/${entry.name}`] : []);
}
const allPages = pages(buildRoot).sort();
const guidePages = allPages.filter(file => !file.startsWith(`${buildRoot}/examples/`));
const exampleRecords = {};
const duplicateExamples = [];
for (const file of readdirSync('docs/data').filter(name => name.endsWith('-examples.yml'))) {
  const records = YAML.parse(readFileSync(`docs/data/${file}`, 'utf8')).examples;
  for (const [id, spec] of Object.entries(records)) {
    if (exampleRecords[id]) duplicateExamples.push(id);
    exampleRecords[id] = spec;
  }
}
const govukComponents = JSON.parse(readFileSync('docs/data/govuk-components-inventory.json', 'utf8'));
function examplesOnSourcePage(url) {
  const source = ['.md.erb', '.md', '.erb', ''].map(suffix => `docs/source${url}${suffix}`).find(existsSync);
  return [...readFileSync(source, 'utf8').matchAll(/example\(['"]([^'"]+)/g)].map(match => match[1]);
}
const nhsComponents = JSON.parse(readFileSync('docs/data/nhs-components-inventory.json', 'utf8'));
const nhsPatterns = JSON.parse(readFileSync('docs/data/nhs-patterns-inventory.json', 'utf8'));
const publishing = JSON.parse(readFileSync('docs/data/publishing-inventory.json', 'utf8'));
const inventories = [
  { name: 'GOV.UK components', rows: govukComponents.components, count: 37, url: row => row.local_path, examples: row => examplesOnSourcePage(row.local_path) },
  { name: 'NHS components', rows: nhsComponents.components, count: 38, url: row => row.local_path, examples: row => row.examples },
  { name: 'NHS patterns', rows: nhsPatterns.patterns, count: 13, url: row => `/${row.documentation_path.replace('docs/source/', '').replace(/\.md\.erb$/, '')}`, examples: row => row.example_ids },
  { name: 'Publishing', rows: publishing.items, count: 42, url: row => row.localPage, examples: row => row.examples },
];
const migratedHistory = YAML.parse(readFileSync('docs/data/page_history.yml', 'utf8'));
function expectedMetadata(file) {
  const destination = file.slice(buildRoot.length + 1);
  const source = ['.md.erb', '.md', '.erb', ''].map(suffix => `docs/source/${destination}${suffix}`).find(existsSync);
  const text = source ? readFileSync(source, 'utf8') : '';
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = header ? YAML.parse(header[1]) : {};
  return { ...migratedHistory[destination], ...frontmatter };
}
const guideUrl = file => `/${file}`;
const exampleUrl = id => `/docs/build/examples/${id}.html`;

function violations(results) {
  return results.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
}
async function assertReflow(page) {
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth })))
    .toEqual(expect.objectContaining({ viewport: 320 }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

// Separate tests keep the expanded catalogue parallel, individually debuggable and below the normal timeout.
test.describe('documentation guide pages', () => {
  for (const file of guidePages) {
    test(`${file.slice(buildRoot.length + 1)}: structure, history, accessibility and reflow`, async ({ page, request }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(guideUrl(file));
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('header .c-brand img')).toHaveAttribute('alt', 'civica.uk');
      await expect(page.locator('header')).not.toContainText(/GOV\.UK|NHS/);
      await expect(page.locator('img[alt="GOV.UK"], img[alt="NHS"], .govuk-header__logotype, .govuk-footer__copyright-logo')).toHaveCount(0);
      expect(await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).not.toMatch(/GDS Transport|New Transport/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
      await expect(page).toHaveTitle(/civica\.uk Design System/);
      if (file !== `${buildRoot}/index.html`) {
        const history = page.locator('.c-history');
        await expect(history).toHaveCount(1);
        await expect(history.locator('> p time')).toHaveCount(2);
        const metadata = expectedMetadata(file);
        expect(await history.locator('> p time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))))
          .toEqual([metadata.published_on, metadata.updated_on]);
        expect(metadata.updated_on >= metadata.published_on, `${file}: chronological metadata`).toBe(true);
        await expect(history.locator('details li')).toHaveCount(metadata.updates.length);
        for (const update of metadata.updates) {
          expect(update.date <= metadata.updated_on, `${file}: update date`).toBe(true);
          await expect(history).toContainText(update.description);
        }
        const dateValues = await history.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')));
        for (const value of dateValues) expect(value, file).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        await expect(history.locator('details li')).not.toHaveCount(0);
        await history.getByText('See all updates', { exact: true }).click();
        await expect(history.locator('details')).toHaveAttribute('open', '');
        await expect(history.locator('details li').first()).toBeVisible();
      }
      for (const preview of await page.locator('.c-example').all()) {
        const id = (await preview.getAttribute('id')).replace(/^example-/, '');
        expect(exampleRecords[id], `Unknown example ${id}`).toBeTruthy();
        const frame = preview.locator('iframe');
        await expect(frame).toHaveAttribute('title', `${exampleRecords[id].title} example`);
        const source = new URL(await frame.getAttribute('src'), page.url());
        expect(source.origin).toBe(new URL(page.url()).origin);
        expect(source.pathname).toBe(`/docs/build/examples/${id}.html`);
        expect(source.searchParams.get('embed')).toBe('1');
        const builtPreview = await request.get(source.href);
        expect(builtPreview.ok()).toBe(true);
        const displayedCode = await preview.locator('pre code').first().textContent();
        const sameMarkup = await page.evaluate(({ built, code }) => {
          const document = new DOMParser().parseFromString(built, 'text/html');
          const expected = document.createElement('template'); expected.innerHTML = code;
          return document.querySelector('.c-example-canvas').innerHTML.trim() === expected.innerHTML.trim();
        }, { built: await builtPreview.text(), code: displayedCode });
        expect(sameMarkup, `${id}: preview and copied HTML share the same final record`).toBe(true);
        const standalone = new URL(await preview.locator('.c-example__top a').getAttribute('href'), page.url());
        expect(standalone.pathname).toBe(source.pathname);
      }
      await assertReflow(page);
      // Each isolated example has its own axe test below; this scan owns the surrounding guide and its controls.
      const result = await new AxeBuilder({ page }).exclude('iframe').analyze();
      expect(violations(result), file).toEqual([]);
    });
  }
});

test.describe('isolated documentation examples', () => {
  for (const [id, spec] of Object.entries(exampleRecords)) {
    test(`${id}: safe baseline, accessibility and narrow layout`, async ({ page, request }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      const response = await request.get(exampleUrl(id));
      expect(response.ok()).toBe(true);
      const built = await response.text();
      await page.goto(exampleUrl(id));
      await expect(page.locator('body')).toHaveAttribute('data-example-id', id);
      await expect(page.locator('.c-example-notice')).toContainText('actions do not control a home');
      await expect(page.locator('img[alt="GOV.UK"], img[alt="NHS"], .govuk-header__logotype, .govuk-footer__copyright-logo')).toHaveCount(0);
      expect(await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily)).not.toMatch(/GDS Transport|New Transport/);
      // Every form starts inert in the actual HTML. JavaScript installs its local handler before enabling controls.
      const unguarded = await page.evaluate(built => {
        const document = new DOMParser().parseFromString(built, 'text/html');
        return [...document.querySelectorAll('form')].flatMap(form => {
          if (form.hasAttribute('data-demo-form')) {
            return [...form.querySelectorAll('input, select, textarea, button')]
              .filter(control => !control.disabled).map(control => control.outerHTML);
          }
          if (form.hasAttribute('data-publishing-filter')) {
            // A disabled default submit button also blocks implicit Enter submission, while the fixed records remain readable.
            const submitters = [...form.querySelectorAll('button, input')].filter(control => ['submit', 'image'].includes(control.type));
            return submitters.length && submitters.every(control => control.disabled) ? [] : [form.outerHTML];
          }
          return [form.outerHTML];
        });
      }, built);
      expect(unguarded, `${id}: no-JavaScript form cannot send a GET request`).toEqual([]);
      await assertReflow(page);
      const result = await new AxeBuilder({ page }).analyze();
      expect(violations(result), id).toEqual([]);
    });
  }
});

test('source catalogues cover 37 GOV.UK components, 38 NHS components, 13 NHS patterns and 42 publishing entries', async () => {
  expect(duplicateExamples).toEqual([]);
  expect(guidePages.length).toBeGreaterThan(80);
  expect(Object.keys(exampleRecords).length).toBeGreaterThanOrEqual(186);
  for (const inventory of inventories) {
    expect(inventory.rows, inventory.name).toHaveLength(inventory.count);
    const paths = inventory.rows.map(inventory.url);
    expect(new Set(paths).size, `${inventory.name}: unique pages`).toBe(inventory.count);
    for (const row of inventory.rows) {
      const destination = `${buildRoot}${inventory.url(row)}`;
      expect(existsSync(destination), `${inventory.name}: ${destination}`).toBe(true);
      const ids = inventory.examples(row);
      expect(ids.length, `${inventory.name}: at least two examples for ${inventory.url(row)}`).toBeGreaterThanOrEqual(2);
      const html = readFileSync(destination, 'utf8');
      for (const id of ids) {
        expect(exampleRecords[id], `${inventory.name}: ${id}`).toBeTruthy();
        expect(html, `${inventory.name}: linked example ${id}`).toContain(`id="example-${id}"`);
        expect(existsSync(`${buildRoot}/examples/${id}.html`), id).toBe(true);
      }
    }
  }
});

test('documentation remains readable without JavaScript, including history, examples and the complete catalogue', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:4173/docs/build/index.html');
    await expect(page.locator('main h1')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.goto('http://127.0.0.1:4173/docs/build/patterns/question-pages.html');
    await page.locator('.c-history summary').click();
    await expect(page.locator('.c-history li').first()).toBeVisible();
    const example = page.locator('#example-nhs-question-room');
    await example.locator('.c-example__code > summary').click();
    await expect(example.locator('#html-nhs-question-room')).toBeVisible();
    await expect(example.locator('#usage-nhs-question-room')).toBeVisible();
    await expect(example.getByRole('button', { name: 'Copy HTML' })).toBeHidden();
    await expect(example.frameLocator('iframe').getByRole('heading', { name: 'Which room should this control appear in?' })).toBeVisible();
    await expect(example.frameLocator('iframe').getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await expect(example.frameLocator('iframe').getByLabel('Living room', { exact: true })).toBeDisabled();
    await assertReflow(page);
    await page.goto('http://127.0.0.1:4173/docs/build/search.html');
    expect(await page.locator('noscript').textContent()).toContain('Browse the complete catalogue');
    const visible = await page.locator('[data-catalogue-item]').count();
    expect(visible).toBeGreaterThan(80);
    await expect(page.locator('[data-catalogue-item][hidden]')).toHaveCount(0);
  } finally { await context.close(); }
});

test('example source tabs support keyboard navigation and copy the same HTML record', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/build/patterns/question-pages.html');
  const example = page.locator('#example-nhs-question-modal');
  await example.locator('.c-example__code > summary').click();
  const html = example.getByRole('tab', { name: 'HTML', exact: true });
  const usage = example.getByRole('tab', { name: 'Use this example', exact: true });
  await html.focus();
  await page.keyboard.press('ArrowRight');
  await expect(usage).toBeFocused();
  await expect(usage).toHaveAttribute('aria-selected', 'true');
  await expect(example.locator('#usage-nhs-question-modal')).toBeVisible();
  await expect(example.locator('#html-nhs-question-modal')).toBeHidden();
  await page.keyboard.press('Home');
  await expect(html).toBeFocused();
  await expect(html).toHaveAttribute('aria-selected', 'true');
  await example.getByRole('button', { name: 'Copy HTML', exact: true }).click();
  await expect(example.locator('.c-copy-status')).toHaveText('HTML copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await example.locator('#code-nhs-question-modal').textContent());
});

test('a demo form has local feedback, no network mutation and no feedback before submitting', async ({ page }) => {
  const mutations = [];
  page.on('request', request => { if (request.method() !== 'GET') mutations.push(`${request.method()} ${request.url()}`); });
  await page.goto(exampleUrl('nhs-identifier-route'));
  const url = page.url();
  await page.getByLabel('Choose from my devices', { exact: true }).check();
  await expect(page.locator('[data-demo-status]')).toHaveText('');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('[data-demo-status]')).toContainText('No Home Assistant setting was changed');
  expect(page.url()).toBe(url);
  expect(mutations).toEqual([]);
});

test('question dialog contains focus, cancels with Escape and restores its opener at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto(exampleUrl('nhs-question-modal'));
  const open = page.getByRole('button', { name: 'Rename this control' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'What should this control be called?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Display name', { exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Tab');
  // Native dialogs may allow a browser-chrome focus stop. They must not focus background page controls.
  await expect(open).not.toBeFocused();
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab');
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  expect(bounds.height).toBeLessThanOrEqual(600);
  const result = await new AxeBuilder({ page }).analyze();
  expect(violations(result)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(open).toBeFocused();
});

test('mini-hub pages have genuine page navigation and a current-page indicator', async ({ page }) => {
  await page.goto(exampleUrl('nhs-mini-hub-reading'));
  await expect(page.getByRole('link', { name: 'Understand recorded readings', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Understand recorded readings', exact: true })).toHaveCSS('font-weight', '700');
  await page.getByRole('link', { name: 'Next: Understand gaps and missing values' }).click();
  await expect(page).toHaveURL(/nhs-mini-hub-gaps\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Understand gaps and missing values');
  await expect(page.getByRole('link', { name: 'Understand gaps and missing values', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Understand gaps and missing values', exact: true })).toHaveCSS('font-weight', '700');
  await page.getByRole('link', { name: 'Previous: Understand recorded readings' }).click();
  await expect(page).toHaveURL(/nhs-mini-hub-reading\.html$/);
});

test('search filters the catalogue locally and shows an honest empty result', async ({ page }) => {
  await page.goto('/docs/build/index.html');
  await page.getByRole('searchbox', { name: 'Search Design System' }).fill('British Sign Language');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/search\.html\?q=British\+Sign\+Language$/);
  const filter = page.locator('[data-catalogue-filter]');
  await expect(filter).toHaveValue('British Sign Language');
  await expect(page.locator('[data-catalogue-item]:visible')).toContainText(['British Sign Language']);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await filter.fill('zzzz-no-such-household-topic');
  await expect(page.locator('[data-catalogue-status]')).toHaveText('0 pages found.');
  await expect(page.locator('[data-catalogue-item]:visible')).toHaveCount(0);
  await filter.clear();
  expect(await page.locator('[data-catalogue-item]:visible').count()).toBeGreaterThan(80);
  expect(requests).toEqual([]);
});

test('mobile navigation works by keyboard and remains available after resizing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/docs/build/patterns/question-pages.html');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const links = page.locator('#primary-navigation');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(links).toBeHidden();
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(links).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(links.locator('a').first()).toBeFocused();
  await menu.focus(); await page.keyboard.press('Space');
  await expect(links).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(menu).toBeHidden();
  await expect(links).toBeVisible();
  await expect(page.locator('.c-section-menu')).toHaveAttribute('open', '');
  await expect(page.locator('.c-sidebar a[aria-current="page"]')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(menu).toBeVisible();
  await expect(links).toBeHidden();
  const section = page.locator('.c-section-menu');
  await expect(section).not.toHaveAttribute('open', '');
  await section.locator(':scope > summary').focus(); await page.keyboard.press('Enter');
  await expect(section).toHaveAttribute('open', '');
  await expect(page.locator('.c-sidebar a[aria-current="page"]')).toBeVisible();
  await assertReflow(page);
});

test('accordion labels stay aligned with visible text after individual and all-section changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const id of ['core-accordion-troubleshooting', 'core-accordion-measures']) {
    await page.goto(exampleUrl(id));
    const sections = page.locator('.govuk-accordion__section-button');
    const checkLabels = async () => {
      const result = await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze();
      expect(violations(result), id).toEqual([]);
    };
    await expect(sections).toHaveCount(2);
    for (const section of await sections.all()) await expect(section).toHaveAttribute('aria-expanded', 'false');
    await checkLabels();
    await sections.first().click();
    await expect(sections.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(sections.first()).toHaveAccessibleName(/Hide this section/);
    await checkLabels();
    await page.getByRole('button', { name: 'Show all sections', exact: true }).click();
    for (const section of await sections.all()) await expect(section).toHaveAttribute('aria-expanded', 'true');
    await checkLabels();
    await page.getByRole('button', { name: 'Hide all sections', exact: true }).click();
    for (const section of await sections.all()) await expect(section).toHaveAttribute('aria-expanded', 'false');
    await checkLabels();
  }
});
