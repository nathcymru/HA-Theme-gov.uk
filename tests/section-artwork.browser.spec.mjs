import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

const mapping = YAML.parse(readFileSync('docs/data/page-illustrations.yml', 'utf8'));
const provenance = JSON.parse(readFileSync('docs/data/section-artwork-provenance.json', 'utf8'));
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

async function assertWholeArtwork(header, source) {
  const image = header.locator('img');
  const panel = header.locator('.c-illustrated-header__art');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node, asset) => node.complete && node.naturalWidth === asset.width && node.naturalHeight === asset.height, source)).toBe(true);
  const box = await image.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(box.width / box.height).toBeCloseTo(source.width / source.height, 2);
  expect(box.x).toBeGreaterThanOrEqual(panelBox.x - 1);
  expect(box.y).toBeGreaterThanOrEqual(panelBox.y - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  // At this test's desktop and phone widths, the image fills its allocated
  // column. The panel, not an upscaled/cropped image, reaches the viewport edge.
  expect(box.width / panelBox.width).toBeGreaterThan(0.8);
}

test('section and key-guide heroes place text left of complete artwork in a right-bleeding panel', async ({ page, request }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width:1440, height:1000 });
  for (const [route, entry] of Object.entries(mapping)) {
    await page.goto(`/docs/build/${route}`);
    const header = page.locator('main .c-illustrated-header');
    await expect(header).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(header.locator('h1')).toHaveCount(1);
    await expect(header.locator('.c-illustrated-header__summary')).toHaveText(entry.summary);
    await expect(header.locator('.c-illustrated-header__text .c-breadcrumbs')).toBeVisible();
    const img = header.locator('img');
    await expect(img).toHaveAttribute('alt', '');
    const bytes = await (await request.get(new URL(await img.getAttribute('src'), page.url()).href)).body();
    const source = provenance.assets.find(asset => asset.path.endsWith(`/${entry.asset}`));
    expect(source, `${route}: artwork has a provenance record`).toBeTruthy();
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    await assertWholeArtwork(header, source);
    const [hero, text, art, heading, summary, image] = await Promise.all([
      header.boundingBox(), header.locator('.c-illustrated-header__text').boundingBox(),
      header.locator('.c-illustrated-header__art').boundingBox(), header.locator('h1').boundingBox(),
      header.locator('.c-illustrated-header__summary').boundingBox(), img.boundingBox(),
    ]);
    expect(hero.height).toBeGreaterThanOrEqual(449);
    expect(Math.abs(hero.x + hero.width - 1440)).toBeLessThanOrEqual(1);
    expect(Math.abs(art.x + art.width - 1440)).toBeLessThanOrEqual(1);
    expect(Math.abs(heading.x - hero.x - 30)).toBeLessThanOrEqual(1);
    expect(text.x + text.width).toBeLessThanOrEqual(art.x + 1);
    expect(heading.x + heading.width).toBeLessThanOrEqual(art.x + 1);
    expect(summary.x + summary.width).toBeLessThanOrEqual(art.x + 1);
    const verticalOverlap = Math.min(summary.y + summary.height, image.y + image.height) - Math.max(heading.y, image.y);
    expect(verticalOverlap, `${route}: the art sits beside the heading and summary, not beneath them`).toBeGreaterThan(24);
    await noOverflow(page);
  }
  for (const route of ['components/button.html', 'components/charts.html', 'index.html']) {
    await page.goto(`/docs/build/${route}`);
    await expect(page.locator('.c-illustrated-header')).toHaveCount(0);
  }
  const published = await (await request.get('/docs/build/reference/documentation-artwork.json')).json();
  expect(published.sections).toEqual(provenance);
});

test('heroes stack complete artwork below text at 320px and grow with doubled text', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width:320, height:900 });
  for (const [route, entry] of Object.entries(mapping)) {
    await page.goto(`/docs/build/${route}`);
    const header = page.locator('.c-illustrated-header');
    const source = provenance.assets.find(asset => asset.path.endsWith(`/${entry.asset}`));
    const summary = header.locator('.c-illustrated-header__summary');
    await expect(summary).toHaveText(entry.summary);
    await expect(page.locator('main h1')).toHaveCount(1);
    await assertWholeArtwork(header, source);
    const before = await header.boundingBox();
    const text = await header.locator('.c-illustrated-header__text').boundingBox();
    const art = await header.locator('.c-illustrated-header__art').boundingBox();
    expect(Math.abs(before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.x + before.width - 320)).toBeLessThanOrEqual(1);
    expect(art.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
    await expect(page.locator('.c-section-menu > summary')).toBeVisible();
    await noOverflow(page);
    // Doubling the root alone would not exercise the explicit pixel heading
    // and summary sizes. Change the actual computed text sizes instead.
    await header.evaluate(node => {
      const sizes = [...node.querySelectorAll('h1,p,.c-breadcrumbs li,.c-breadcrumbs a')]
        .map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`;
    });
    const after = await header.boundingBox();
    const enlargedText = await header.locator('.c-illustrated-header__text').boundingBox();
    const enlargedArt = await header.locator('.c-illustrated-header__art').boundingBox();
    expect(after.height).toBeGreaterThan(before.height);
    expect(enlargedArt.y).toBeGreaterThanOrEqual(enlargedText.y + enlargedText.height - 1);
    for (const selector of ['h1', '.c-illustrated-header__summary']) {
      expect(await header.locator(selector).evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await expect(summary).toHaveText(entry.summary);
    await assertWholeArtwork(header, source);
    await noOverflow(page);
  }
});

test('header text and section navigation remain complete without illustrations or scripting at 320px', async ({ browser, baseURL }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ javaScriptEnabled:false, viewport:{ width:320, height:900 } });
  const page = await context.newPage();
  try {
    await page.route('**/images/{section,guide}-*.svg', route => route.abort());
    for (const [route, entry] of Object.entries(mapping)) {
      await page.goto(new URL(`/docs/build/${route}`, baseURL).href);
      await expect(page.locator('.c-illustrated-header__summary')).toHaveText(entry.summary);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('.c-section-menu > summary')).toBeVisible();
      await expect(page.locator('.c-sidebar')).toBeVisible();
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
