import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

const mapping = YAML.parse(readFileSync('docs/data/page-illustrations.yml', 'utf8'));
const provenance = JSON.parse(readFileSync('docs/data/section-artwork-provenance.json', 'utf8'));
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('all agreed section and key-guide headers use complete original artwork and visible summaries', async ({ page, request }) => {
  for (const [route, entry] of Object.entries(mapping)) {
    await page.goto(`/docs/build/${route}`);
    const header = page.locator('main .c-illustrated-header');
    await expect(header).toHaveCount(1);
    await expect(header.locator('h1')).toHaveCount(1);
    await expect(header.locator('p')).toHaveText(entry.summary);
    const img = header.locator('img');
    await expect(img).toHaveAttribute('alt', '');
    await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth === 960 && node.naturalHeight === 320)).toBe(true);
    const bytes = await (await request.get(new URL(await img.getAttribute('src'), page.url()).href)).body();
    const source = provenance.assets.find(asset => asset.path.endsWith(`/${entry.asset}`));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    const box = await img.boundingBox();
    expect(box.width / box.height).toBeCloseTo(3, 1);
    await noOverflow(page);
  }
  for (const route of ['components/button.html', 'components/charts.html', 'index.html']) {
    await page.goto(`/docs/build/${route}`);
    await expect(page.locator('.c-illustrated-header')).toHaveCount(0);
  }
  const published = await (await request.get('/docs/build/reference/documentation-artwork.json')).json();
  expect(published.sections).toEqual(provenance);
});

test('header text and navigation remain complete without illustrations or scripting at320px', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled:false, viewport:{ width:320, height:900 } });
  const page = await context.newPage();
  try {
    await page.route('**/images/{section,guide}-*.svg', route => route.abort());
    for (const [route, entry] of Object.entries(mapping)) {
      await page.goto(new URL(`/docs/build/${route}`, baseURL).href);
      await expect(page.locator('.c-illustrated-header__summary')).toHaveText(entry.summary);
      await expect(page.locator('main h1')).toBeVisible();
      await noOverflow(page);
    }
  } finally { await context.close(); }
});

test('data, colour and optional household identity are discoverable without a local Brand guidance group', async ({ page }) => {
  await page.goto('/docs/build/styles/index.html');
  await expect(page.getByRole('complementary', {name:'Section navigation'})).not.toContainText('Brand guidance');
  for (const name of ['Data visualisation','Colour roles and accessibility']) {
    await expect(page.locator('main').getByRole('link', {name,exact:true}).first()).toBeVisible();
  }
  await page.goto('/docs/build/styles/brand.html');
  await expect(page.locator('main h1')).toHaveText('Project identity');
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Community',exact:true})).toHaveAttribute('aria-current','true');
  await page.goto('/docs/build/get-started/personalisation.html');
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Get started',exact:true})).toHaveAttribute('aria-current','true');
});
