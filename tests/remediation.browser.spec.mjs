import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import YAML from 'yaml';

const read = path => readFileSync(path, 'utf8');
const rationalisation = JSON.parse(read('docs/data/component-rationalisation.json'));
const gaps = JSON.parse(read('docs/data/ha-component-gaps.json'));
const recordsByRoute = new Map(rationalisation.pageInventory.map(record => [record.url, record]));
const families = new Map(rationalisation.families.map(record => [record.id, record]));
const exampleRecords = {};
for (const file of readdirSync('docs/data').filter(name => name.endsWith('-examples.yml'))) {
  Object.assign(exampleRecords, YAML.parse(read(`docs/data/${file}`)).examples);
}
const exampleIds = text => [...text.matchAll(/example\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
const cardExamples = exampleIds(read('docs/source/components/cards.html.md.erb'));
const specificationPages = readdirSync('docs/source/home-assistant').filter(name => name.endsWith('.html.md.erb')).flatMap(name => {
  const path = `docs/source/home-assistant/${name}`;
  const text = read(path);
  const metadata = YAML.parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  return metadata.gap_id ? [{ path, url: `/home-assistant/${name.replace(/\.md\.erb$/, '')}`, metadata, examples: exampleIds(text) }] : [];
});
const builtUrl = route => `/docs/build${route}`;
const exampleUrl = id => builtUrl(`/examples/${id}.html`);
const pathname = href => new URL(href).pathname;
async function noPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

// These checks exercise the retained URLs and their real navigation, rather than
// treating an ownership JSON entry as evidence that a usable route was shipped.
for (const alias of rationalisation.aliasProposals) {
  test(`preserved family route ${alias.from} reaches its canonical guidance`, async ({ page }) => {
    const record = recordsByRoute.get(alias.from);
    const family = families.get(record.familyId);
    await page.goto(builtUrl(alias.from));
    expect(pathname(page.url())).toBe(builtUrl(alias.from));
    const navigation = page.getByRole('navigation', { name: 'Related guidance in this family', exact: true });
    await expect(navigation).toBeVisible();
    const ownerLink = navigation.locator('p a');
    await expect(ownerLink).toHaveCount(1);
    expect(pathname(new URL(await ownerLink.getAttribute('href'), page.url()))).toBe(builtUrl(alias.canonicalOwner));
    const related = await navigation.locator('ul a').evaluateAll(links => links.map(link => new URL(link.href).pathname));
    expect(related.sort()).toEqual(family.memberPages.filter(route => route !== alias.from).map(builtUrl).sort());
    await ownerLink.click();
    await expect(page).toHaveURL(url => url.pathname === builtUrl(alias.canonicalOwner));
    await expect(page.locator('main h1')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname === builtUrl(alias.from));
  });
}

test('the completed register preserves 39 variant routes and maps all 30 specification gaps once', async () => {
  expect(rationalisation.aliasProposals).toHaveLength(39);
  expect(specificationPages).toHaveLength(30);
  expect(new Set(specificationPages.map(page => page.metadata.gap_id)).size).toBe(30);
  expect(specificationPages.map(page => page.metadata.gap_id).sort()).toEqual(gaps.findings.map(gap => gap.id).sort());
  expect(cardExamples).toHaveLength(14);
  expect(new Set(cardExamples).size).toBe(14);
});

for (const spec of specificationPages) {
  test(`${spec.metadata.gap_id} publishes its dedicated specification and complete example set`, async ({ page, request }) => {
    const gap = gaps.findings.find(record => record.id === spec.metadata.gap_id);
    expect(gap.specification, `${gap.id}: completed specification mapping`).toBeTruthy();
    expect(gap.specification.path).toBe(spec.path);
    expect(gap.specification.url).toBe(spec.url);
    expect(gap.specification.examples).toEqual(spec.examples);
    expect(spec.examples.length).toBeGreaterThanOrEqual(3);
    expect(new Set(spec.examples).size).toBe(spec.examples.length);
    await page.goto(builtUrl(spec.url));
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.c-example')).toHaveCount(spec.examples.length);
    // Each shown example opens a complete, independently usable specimen. This
    // is a documentation acceptance check, not a native feature implementation.
    for (const id of spec.examples) {
      expect(exampleRecords[id], id).toBeTruthy();
      const preview = page.locator(`#example-${id}`);
      await expect(preview).toBeVisible();
      await preview.scrollIntoViewIfNeeded();
      const standalone = new URL(await preview.locator('.c-example__top a').getAttribute('href'), page.url());
      expect(standalone.pathname).toBe(exampleUrl(id));
      const response = await request.get(standalone.href);
      expect(response.ok(), id).toBe(true);
      const content = preview.frameLocator('iframe').locator('.c-example-canvas');
      await expect(content.locator('h1,h2,h3').first()).toBeVisible();
      expect(await content.locator('p,dl,ul,ol,table,form').count(), `${id}: supporting task content`).toBeGreaterThan(0);
      await expect(preview.frameLocator('iframe').locator('.c-example-notice')).toContainText('actions do not control a home');
    }
    if (gap.specification.acceptance_anchor) {
      const anchor = gap.specification.acceptance_anchor.replace(/^.*#/, '');
      await expect(page.locator(`[id="${anchor}"]`)).toHaveCount(1);
    }
  });
}

for (const id of cardExamples) {
  test(`complete card ${id}: media, separate controls and real local destinations`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(exampleUrl(id));
    const canvas = page.locator('.c-example-canvas');
    await expect(canvas.locator('.civica-card-demo').first()).toBeVisible();
    const nestedControls = await canvas.evaluate(root => {
      const interactive = 'a[href],button,input,select,textarea,[role="button"],[role="link"]';
      return [...root.querySelectorAll(interactive)].filter(node => node.querySelector(interactive)).map(node => node.outerHTML);
    });
    expect(nestedControls).toEqual([]);
    for (const image of await canvas.locator('img').all()) {
      await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveAttribute('alt');
      expect(await image.evaluate(node => node.getBoundingClientRect().width <= node.parentElement.getBoundingClientRect().width + 1)).toBe(true);
    }
    const anchors = canvas.locator('a[href^="#"]');
    for (let index = 0; index < await anchors.count(); index++) {
      const anchor = anchors.nth(index);
      const fragment = (await anchor.getAttribute('href')).slice(1);
      const target = canvas.locator(`[id="${fragment}"]`);
      await expect(target).toHaveCount(1);
      await anchor.click();
      await expect(page).toHaveURL(url => decodeURIComponent(url.hash.slice(1)) === fragment);
      await expect(target).toBeVisible();
      expect((await target.innerText()).trim().length).toBeGreaterThan(40);
    }
    await noPageOverflow(page);
  });
}

test('a card preview request gives local feedback while its reported states and details stay unchanged', async ({ page }) => {
  const mutations = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
  await page.goto(exampleUrl('local-card-actions'));
  const card = page.locator('article.civica-card-demo');
  const reading = card.locator('strong');
  const previous = await reading.innerText();
  await expect(card.locator('[data-demo-status]')).toBeEmpty();
  const preview = card.getByRole('button', { name: 'Preview turn-on request', exact: true });
  await preview.focus(); await page.keyboard.press('Enter');
  await expect(card.locator('[data-demo-status]')).toContainText('no device command was sent');
  await expect(reading).toHaveText(previous);
  await card.getByRole('link', { name: 'View light details', exact: true }).click();
  await expect(page.locator('#light-details')).toBeVisible();
  await expect(page.locator('#light-details li')).toHaveCount(2);
  expect(mutations).toEqual([]);
});

test('missing card media has a usable authored fallback and destination without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173${exampleUrl('card-image-missing')}`);
  await expect(page.getByText('Room image unavailable', { exact: true })).toBeVisible();
  await expect(page.locator('.c-example-canvas img')).toHaveCount(0);
  await page.locator('article').getByRole('link', { name: 'Garden room overview', exact: true }).click();
  await expect(page.locator('#missing-image-details')).toBeVisible();
  await expect(page.locator('#missing-image-details')).toContainText('Their current states are not supplied');
  await noPageOverflow(page);
  await context.close();
});

test('the legacy lighting element loads from the stable bundle and preserves the maintained card behaviour', async ({ page, request }) => {
  const bundle = await request.get('/card/dist/civica-house-lighting-card.js');
  expect(bundle.ok()).toBe(true);
  await page.goto('/card/dev/');
  await expect(page.locator('civica-house-lighting-card h2.title')).toHaveText('House lighting');
  const compatibility = await request.get('/card/dist/govuk-house-lighting-card.js');
  expect(compatibility.ok()).toBe(true);
  expect(await compatibility.text()).toContain("import './civica-house-lighting-card.js'");
  await page.evaluate(async () => {
    const original = customElements.get('civica-house-lighting-card');
    await import('/card/dist/govuk-house-lighting-card.js');
    if (customElements.get('civica-house-lighting-card') !== original) throw new Error('Compatibility import registered a second card');
  });
  await page.evaluate(() => {
    const legacy = document.createElement('govuk-house-lighting-card');
    legacy.setConfig({ type: 'custom:govuk-house-lighting-card' });
    legacy.hass = window.fixtureHass;
    document.getElementById('mount').append(legacy);
  });
  const modern = page.locator('civica-house-lighting-card');
  const legacy = page.locator('govuk-house-lighting-card');
  await expect(legacy.locator('h2.title')).toHaveText('House lighting');
  expect(await legacy.locator('[data-role=sub]').allTextContents()).toEqual(await modern.locator('[data-role=sub]').allTextContents());
  await legacy.getByRole('button', { name: 'Turn off Lounge', exact: true }).click();
  await modern.getByRole('button', { name: 'Turn off Lounge', exact: true }).click();
  const calls = await page.evaluate(() => window.calls);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]).toMatchObject({ domain: 'script', service: 'govuk_lights_stop', data: { room: 'lounge', turn_off: true } });
  for (const card of [legacy, modern]) {
    await expect(card.locator('[data-room="lounge"].row [data-role=request-status]')).toContainText('Waiting for the requested lights to report off');
    await expect(card.locator('[data-room="lounge"].row [data-role=toggle]')).toBeDisabled();
  }
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname === '/card/dist/civica-house-lighting-card.js'))).toBe(true);
});

test('quiet structural borders remain distinct from input boundaries in the built documentation', async ({ page }) => {
  await page.goto('/docs/build/components/cards.html');
  for (const selector of ['.c-example', '.c-history', '.c-contribute']) {
    const style = await page.locator(selector).first().evaluate(node => ({ color: getComputedStyle(node).borderTopColor, width: getComputedStyle(node).borderTopWidth }));
    expect(style, selector).toEqual({ color: 'rgb(206, 206, 206)', width: '1px' });
  }
  await page.goto(exampleUrl('local-card-actions'));
  expect(await page.locator('.civica-card-demo').evaluate(node => getComputedStyle(node).borderTopColor)).toBe('rgb(206, 206, 206)');
  await page.goto(exampleUrl('ha-flow-022-draft'));
  const input = page.getByLabel('Card title', { exact: true });
  expect(await input.evaluate(node => ({ color: getComputedStyle(node).borderTopColor, width: getComputedStyle(node).borderTopWidth })))
    .toEqual({ color: 'rgb(11, 12, 12)', width: '2px' });
});

for (const [width, fontSize] of [[320, '18px'], [1024, '19px']]) {
  test(`main form roles use the declared ${fontSize} scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(exampleUrl('ha-flow-022-draft'));
    for (const selector of ['.govuk-input', '.govuk-select', '.govuk-button', '.govuk-label', '.govuk-hint']) {
      expect(await page.locator(selector).first().evaluate(node => getComputedStyle(node).fontSize), selector).toBe(fontSize);
    }
    await page.goto(exampleUrl('nhs-count-over-limit'));
    for (const selector of ['.govuk-textarea', '.govuk-error-message', '.govuk-hint']) {
      expect(await page.locator(selector).first().evaluate(node => getComputedStyle(node).fontSize), selector).toBe(fontSize);
    }
    await noPageOverflow(page);
  });
}

test('200% text keeps long card content, independent actions and form feedback usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  for (const id of ['card-long-name', 'card-responsive-group', 'local-card-actions', 'ha-flow-022-draft']) {
    await page.goto(exampleUrl(id));
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await noPageOverflow(page);
    for (const card of await page.locator('.civica-card-demo').all()) {
      expect(await card.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    }
    if (id === 'local-card-actions') {
      const button = page.getByRole('button', { name: 'Preview turn-on request', exact: true });
      expect(await button.evaluate(node => getComputedStyle(node).fontSize)).toBe('36px');
      await button.focus(); await page.keyboard.press('Enter');
      await expect(page.locator('[data-demo-status]')).toContainText('no device command was sent');
      await page.getByRole('link', { name: 'View light details', exact: true }).click();
      await expect(page.locator('#light-details')).toBeVisible();
    }
    if (id === 'ha-flow-022-draft') {
      await page.getByLabel('Card title', { exact: true }).fill('A long example reading light name');
      await page.getByRole('button', { name: 'Review example draft', exact: true }).click();
      await expect(page.locator('[data-demo-status]')).toContainText('No dashboard configuration was saved');
    }
    await noPageOverflow(page);
  }
});
