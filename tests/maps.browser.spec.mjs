import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { MAP_RECORDS, MAP_ROLES, mapStyle } from '../docs/javascript/map-examples.mjs';

const route = '/docs/build/examples/map-neighbourhood-records.html';
const provider = 'https://vector.openstreetmap.org/shortbread_v1/tilejson.json';
// Exercise the real locally bundled renderer with deterministic empty vector
// responses. CI never fetches OSM. Actual populated geography is a separate
// recorded manual check; an empty fixture does not establish map-data fidelity.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

async function interceptProvider(page, fail = false) {
  const requests = [];
  await page.route('https://**/*', async intercepted => {
    const url = intercepted.request().url();
    requests.push(url);
    expect(new URL(url).origin).toBe('https://vector.openstreetmap.org');
    const headers = { 'access-control-allow-origin': '*', 'cache-control': 'public,max-age=604800' };
    if (fail) return intercepted.fulfill({ status: 503, contentType: 'text/plain', headers, body: 'Test provider unavailable' });
    if (url === provider) return intercepted.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ tilejson: '3.0.0', name: 'Empty deterministic test source', scheme: 'xyz', minzoom: 0, maxzoom: 14, tiles: ['https://vector.openstreetmap.org/test/{z}/{x}/{y}.mvt'], attribution: '© OpenStreetMap contributors' }) });
    expect(url).toMatch(/^https:\/\/vector\.openstreetmap\.org\/test\/\d+\/\d+\/\d+\.mvt$/);
    return intercepted.fulfill({ status: 200, contentType: 'application/vnd.mapbox-vector-tile', headers, body: Buffer.alloc(0) });
  });
  return requests;
}

const mapRoot = page => page.locator('[data-map-example]');
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('four map styles retain source geography, local labels and six explicit roles', () => {
  const styles = Object.entries(MAP_ROLES).map(([key, roles]) => {
    const [tone, mode] = key.split('-');
    const style = mapStyle(tone, mode, provider);
    expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    expect(new Set(Object.values(roles)).size).toBe(6);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(Object.values(style.sources)).toEqual([expect.objectContaining({ type: 'vector', url: provider })]);
    const labels = style.layers.filter(layer => layer.type === 'symbol');
    expect(labels.length).toBeGreaterThan(0);
    for (const layer of labels) {
      expect(layer.layout['text-font']).toEqual(['Arial']);
      expect(layer.layout['text-size']).toBeGreaterThanOrEqual(14);
      expect(layer.layout['icon-image']).toBeUndefined();
      expect(layer.paint['text-opacity']).toBe(1);
    }
    return style;
  });
  for (const style of styles.slice(1)) {
    expect(style.sources).toEqual(styles[0].sources);
    expect(style.layers.map(({ id, type, source, filter, layout }) => ({ id, type, source, filter, layout })))
      .toEqual(styles[0].layers.map(({ id, type, source, filter, layout }) => ({ id, type, source, filter, layout })));
  }
  expect(new Set(styles.map(style => JSON.stringify(style.layers.map(layer => layer.paint)))).size).toBe(4);
  expect(MAP_RECORDS.filter(record => record.coordinates)).toHaveLength(2);
  expect(MAP_RECORDS.find(record => record.id === 'c').coordinates).toBeNull();
});

test('the passive map specimen explains its source and makes no external request', async ({ page }) => {
  const requests = await interceptProvider(page);
  await page.goto(route);
  await expect(mapRoot(page)).toHaveAttribute('data-map-initialised', 'true');
  await expect(page.getByRole('button', { name: 'Load OpenStreetMap', exact: true })).toBeEnabled();
  await expect(page.locator('[data-map-canvas]')).toBeHidden();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('[data-map-status]')).toContainText('Map not loaded');
  await expect(page.locator('.civica-map-demo__attribution')).toContainText('OpenStreetMap contributors');
  expect(requests).toEqual([]);
});

test('map records and missing-location meaning remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 850 } });
  const page = await context.newPage();
  const requests = await interceptProvider(page);
  await page.goto(`http://127.0.0.1:4173${route}`);
  await expect(page.getByRole('button', { name: 'Load OpenStreetMap', exact: true })).toBeDisabled();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').last()).toContainText('No location observation');
  await expect(page.getByText('2 of 3 configured devices have a reported location.', { exact: false })).toBeVisible();
  await noOverflow(page);
  expect(requests).toEqual([]);
  await context.close();
});

test('mocked vector renderer preserves records through appearance, keyboard selection and close', async ({ page }) => {
  test.setTimeout(60000);
  const requests = await interceptProvider(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route);
  const records = await page.locator('tbody').innerText();
  await page.getByRole('button', { name: 'Load OpenStreetMap', exact: true }).click();
  await expect(mapRoot(page)).toHaveAttribute('data-map-state', 'ready');
  expect(requests).toContain(provider);
  await expect(page.locator('.civica-map-demo__marker')).toHaveCount(2);
  await expect(page.locator('.maplibregl-ctrl-scale')).toBeVisible();
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap');
  const readings = await mapRoot(page).evaluate(root => JSON.stringify(root.mapExample.records));
  for (const [tone, mode] of [['vivid', 'light'], ['muted', 'light'], ['muted', 'dark'], ['vivid', 'dark']]) {
    await page.getByLabel('Colour strength').selectOption(tone);
    await page.getByLabel('Display mode').selectOption(mode);
    await expect.poll(() => mapRoot(page).evaluate(root => !!root.mapExample?.map.isStyleLoaded() && !!root.mapExample.map.getLayer('example-accuracy-outline'))).toBe(true);
    expect(await page.locator('tbody').innerText()).toBe(records);
    expect(await mapRoot(page).evaluate(root => JSON.stringify(root.mapExample.records))).toBe(readings);
  }
  await page.getByRole('button', { name: 'Select tool case', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-map-selected]')).toContainText('B — example tool case');
  await expect(page.locator('.civica-map-demo__marker--b')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.civica-map-demo__marker--a')).toHaveAttribute('aria-pressed', 'false');
  expect(await mapRoot(page).evaluate(root => root.mapExample.map.getCenter().toArray())).toEqual(MAP_RECORDS[1].coordinates);
  await page.setViewportSize({ width: 320, height: 850 });
  await noOverflow(page);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  await page.getByRole('button', { name: 'Close map', exact: true }).click();
  await expect(mapRoot(page)).toHaveAttribute('data-map-state', 'closed');
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load OpenStreetMap', exact: true })).toBeFocused();
  expect(await page.locator('tbody').innerText()).toBe(records);
  expect(errors).toEqual([]);
});

test('a refused provider leaves complete records, honest failure and a working close action', async ({ page }) => {
  const requests = await interceptProvider(page, true);
  await page.goto(route);
  const records = await page.locator('tbody').innerText();
  await page.getByRole('button', { name: 'Load OpenStreetMap', exact: true }).click();
  await expect(mapRoot(page)).toHaveAttribute('data-map-state', 'error');
  await expect(page.locator('[data-map-status]')).toContainText('could not load');
  expect(await page.locator('tbody').innerText()).toBe(records);
  await page.getByRole('button', { name: 'Close map', exact: true }).click();
  await expect(page.locator('[data-map-canvas]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Load OpenStreetMap', exact: true })).toBeEnabled();
  expect(requests).toEqual([provider]);
});

test('the background-unavailable specimen is a complete text fallback at narrow and enlarged sizes', async ({ page }) => {
  const requests = await interceptProvider(page);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/docs/build/examples/map-background-unavailable.html');
  await expect(page.getByRole('heading', { name: 'Map background unavailable', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').last()).toContainText('Not supplied');
  await noOverflow(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await noOverflow(page);
  expect(requests).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
});
