import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const artwork = JSON.parse(readFileSync('docs/data/project-artwork-provenance.json', 'utf8'));
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('the homepage story leads to About under Get started with complete, unchanged artwork', async ({ page, request }) => {
  await page.goto('/docs/build/index.html');
  const intro = page.locator('.c-project-intro');
  await expect(intro).toContainText('I created civica.uk');
  await expect(intro).toContainText('not affiliated');
  await intro.getByRole('link').click();
  await expect(page).toHaveURL(/\/get-started\/about\.html$/);
  await expect(page.locator('main h1')).toHaveText('About civica.uk');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Get started', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Get started');
  const figures = page.locator('figure.c-project-figure');
  await expect(figures).toHaveCount(3);
  for (const asset of artwork.assets) {
    const figure = figures.filter({ has: page.locator(`img[src$="/${asset.id}.svg"]`) });
    await figure.scrollIntoViewIfNeeded();
    const img = figure.locator('img');
    await expect(img).toHaveAttribute('alt', '');
    await expect(figure.locator('figcaption')).toHaveText(asset.caption);
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth === 960 && el.naturalHeight === 560)).toBe(true);
    const response = await request.get(new URL(await img.getAttribute('src'), page.url()).href);
    expect(response.ok()).toBe(true);
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(asset.sha256);
  }
  const publicArtwork = await request.get('/docs/build/reference/documentation-artwork.json');
  expect((await publicArtwork.json()).project).toEqual(artwork);
});

test('the project story retains its meaning with images unavailable, no JavaScript and enlarged text', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  try {
    await page.route('**/images/project-*.svg', route => route.abort());
    await page.goto(new URL('/docs/build/get-started/about.html', baseURL).href);
    for (const asset of artwork.assets) await expect(page.locator('figcaption').filter({ hasText: asset.caption })).toBeVisible();
    await expect(page.locator('main')).toContainText('older relatives, neurodivergent people and guests');
    await expect(page.getByRole('link', { name: 'Use the writing guide', exact: true })).toBeVisible();
    await noOverflow(page);
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main figcaption')]
        .map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    await noOverflow(page);
    // The guide-wide suite runs axe with scripting enabled. Here the browser's
    // no-script context deliberately prevents axe's injected execution frame.
  } finally { await context.close(); }
});
