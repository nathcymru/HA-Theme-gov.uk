import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const buildRoot = resolve('docs/build');
const fingerprint = /-[a-f0-9]{8}\.(?:css|js)$/;
const filesBelow = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? filesBelow(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);

test('all published styles and scripts have resolvable content-hashed URLs while image paths and bytes stay intact', () => {
  const assets = new Set();
  for (const file of filesBelow(buildRoot).filter(path => path.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const [, attribute] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      const url = new URL(attribute, `https://docs.invalid/${relative(buildRoot, file)}`);
      if (url.origin !== 'https://docs.invalid' || !/\.(?:css|js)$/.test(url.pathname)) continue;
      expect(url.pathname, `${relative(buildRoot, file)}: cache-safe asset URL`).toMatch(fingerprint);
      expect(existsSync(resolve(buildRoot, '.' + decodeURIComponent(url.pathname))), url.pathname).toBe(true);
      assets.add(url.pathname);
    }
  }
  expect(assets.size).toBeGreaterThanOrEqual(6);
  for (const directory of ['stylesheets', 'javascripts']) {
    for (const file of filesBelow(`${buildRoot}/${directory}`).filter(path => /\.(?:css|js)$/.test(path))) {
      expect(file, 'no obsolete unversioned styles/scripts remain in the build').toMatch(fingerprint);
    }
  }
  const imageRoot = resolve('docs/source/images');
  const images = filesBelow(imageRoot);
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) {
    const built = resolve(buildRoot, 'images', relative(imageRoot, image));
    expect(existsSync(built), `unchanged image URL: ${relative(imageRoot, image)}`).toBe(true);
    expect(readFileSync(built).equals(readFileSync(image)), `unchanged image bytes: ${relative(imageRoot, image)}`).toBe(true);
  }
});

test('new image-card HTML uses current styling and behaviour even when old unversioned assets are unusable', async ({ page }) => {
  const obsoleteRequests = [];
  await page.route(/\/docs\/build\/(?:stylesheets|javascripts)\/.*\.(?:css|js)(?:\?.*)?$/, route => {
    const url = new URL(route.request().url());
    if (fingerprint.test(url.pathname)) return route.continue();
    obsoleteRequests.push(url.pathname);
    return route.abort();
  });
  await page.setViewportSize({ width: 1660, height: 1000 });
  await page.goto('/docs/build/examples/card-image-device.html');
  const card = page.locator('article.civica-card-demo');
  const geometry = await card.evaluate(node => ({
    width: node.getBoundingClientRect().width,
    maxWidth: getComputedStyle(node).maxWidth,
    border: getComputedStyle(node).borderTopColor,
  }));
  expect(geometry.maxWidth).toBe('640px');
  expect(geometry.width).toBeLessThanOrEqual(640);
  expect(geometry.border).toBe('rgb(206, 206, 206)');
  await expect.poll(() => card.locator('img').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await card.getByRole('button', { name: 'Preview turn-on request', exact: true }).click();
  await expect(card.locator('[data-demo-status]')).toContainText('no device command was sent');
  await expect(card.locator('strong')).toHaveText('Last reported state: Off');
  expect(obsoleteRequests).toEqual([]);
});

test('project-subpath charts load hashed catalogue scripts and expose identical copyable HTML', async ({ page, request }) => {
  // Serve the existing build under the actual Pages project prefix without
  // creating another server or modifying the public build directory.
  await page.route('**/civica/**', async route => {
    const upstream = route.request().url().replace('/civica/', '/docs/build/');
    await route.fulfill({ response: await route.fetch({ url: upstream }) });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [guide, id] of [
    ['components/charts.html', 'local-chart-power'],
    ['styles/brand-data.html', 'bg-data-operational-power'],
  ]) {
    await page.goto(`/civica/${guide}`);
    const preview = page.locator(`#example-${id}`);
    await preview.scrollIntoViewIfNeeded();
    const frame = preview.frameLocator('iframe');
    await expect(frame.locator('canvas').first()).toBeVisible();
    const displayed = await preview.locator('pre code').first().textContent();
    expect(displayed).toMatch(/src="\.\.\/javascripts\/energy-chart-examples-[a-f0-9]{8}\.js"/);
    const response = await request.get(`/docs/build/examples/${id}.html`);
    expect(response.ok()).toBe(true);
    expect(await page.evaluate(({ html, displayed }) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      const copied = document.createElement('template'); copied.innerHTML = displayed;
      return document.querySelector('.c-example-canvas').innerHTML.trim() === copied.innerHTML.trim();
    }, { html: await response.text(), displayed })).toBe(true);
    const frameElement = preview.locator('iframe');
    expect(new URL(await frameElement.getAttribute('src'), page.url()).pathname)
      .toBe(`/civica/examples/${id}.html`);
  }
  expect(errors).toEqual([]);
});
