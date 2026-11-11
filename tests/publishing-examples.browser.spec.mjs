import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const examples = YAML.parse(readFileSync('docs/data/publishing-examples.yml', 'utf8')).examples;
const filters = Object.entries(examples).filter(([, spec]) => spec.html.includes('data-publishing-filter'));
const autocomplete = filters.filter(([, spec]) => spec.html.includes('<datalist'));
const printExamples = Object.entries(examples).filter(([, spec]) => spec.html.includes('data-publishing-print'));
const exampleUrl = id => `/docs/build/examples/${id}.html`;

// These tests own the fixed-record behaviour. The main docs suite owns source
// parity, rendering, accessibility and the shared example-frame controls.
test('publishing finders filter real local records and recover from no matches', async ({ page }) => {
  test.setTimeout(60_000);
  expect(filters).toHaveLength(16);
  for (const [id] of filters) {
    await page.goto(exampleUrl(id));
    const form = page.locator('form[data-publishing-filter]');
    const records = page.locator('[data-publishing-record]:visible');
    await expect(form.locator('button[type=submit]'), id).toBeEnabled();
    await expect(records, id).toHaveCount(3);
    const requests = [];
    const track = request => requests.push(request.url());
    page.on('request', track);
    const initialUrl = page.url();
    try {
      await form.locator('[name=query]').fill('unmatched-example-xyz');
      await form.locator('button[type=submit]').click();
      await expect(records, id).toHaveCount(0);
      await expect(page.locator('[data-publishing-empty]'), id).toBeVisible();
      await expect(form.locator('[data-publishing-status]'), id).toHaveText('0 of 3 example records shown. No live data was searched.');
      await form.locator('[data-publishing-reset]').click();
      await expect(records, id).toHaveCount(3);
      await expect(page.locator('[data-publishing-empty]'), id).toBeHidden();
      await expect(form.locator('[name=query]'), id).toHaveValue('');
      await expect(form.locator('[name=query]'), id).toBeFocused();
      await expect(form.locator('[data-publishing-status]'), id).toHaveText('3 of 3 example records shown. No live data was searched.');
      await expect(page, id).toHaveURL(initialUrl);
      expect(requests, `${id}: filtering must not request a backend`).toEqual([]);
    } finally {
      page.off('request', track);
    }
  }
});

test('publishing filters combine query words with alternative selected areas', async ({ page }) => {
  await page.goto(exampleUrl('pub-patterns-search-filter-1'));
  const form = page.locator('form[data-publishing-filter]');
  const results = page.locator('[data-publishing-record]:visible');
  await form.locator('#area-kitchen').check();
  await form.locator('button[type=submit]').click();
  await expect(results).toHaveCount(2);
  await expect(results).toContainText(['Example kitchen lamp', 'Example kitchen thermometer']);

  await form.locator('[name=query]').fill('EXAMPLE lamp');
  await form.locator('button[type=submit]').click();
  await expect(results).toHaveCount(1);
  await expect(results).toContainText(['Example kitchen lamp']);

  await form.locator('#area-hall').check();
  await form.locator('button[type=submit]').click();
  await expect(results).toHaveCount(2);
  await expect(results).toContainText(['Example hall lamp', 'Example kitchen lamp']);

  await form.locator('[name=query]').fill('thermometer');
  await form.locator('#area-kitchen').uncheck();
  await form.locator('button[type=submit]').click();
  await expect(results).toHaveCount(0);
  await form.locator('[data-publishing-reset]').click();
  await expect(results).toHaveCount(3);
  await expect(form.locator('input[data-publishing-facet]:checked')).toHaveCount(0);
});

test('native autocomplete suggestions match the searchable fixed records', async ({ page }) => {
  expect(autocomplete).toHaveLength(2);
  for (const [id] of autocomplete) {
    await page.goto(exampleUrl(id));
    const input = page.locator('[name=query]');
    const listId = await input.getAttribute('list');
    expect(listId, id).toBeTruthy();
    await expect(page.locator(`label[for="${await input.getAttribute('id')}"]`), id).toHaveCount(1);
    const options = page.locator(`datalist[id="${listId}"] option`);
    await expect(options, id).toHaveCount(3);
    const titles = await page.locator('[data-publishing-record] summary').allTextContents();
    const suggestions = await options.evaluateAll(nodes => nodes.map(node => node.value));
    expect(suggestions, id).toEqual(titles.map(title => title.trim()));
    // Use the suggested value through the ordinary field: browser-native
    // popup interaction differs by platform and is not a custom JS listbox.
    await input.fill(suggestions[0]);
    await input.press('Enter');
    await expect(page.locator('[data-publishing-record]:visible'), id).toHaveCount(1);
    await expect(page.locator('[data-publishing-record]:visible summary'), id).toHaveText(suggestions[0]);
    await expect(page.locator('[data-publishing-status]'), id).toHaveText('1 of 3 example records shown. No live data was searched.');
  }
});

test('publishing forms cannot submit queries when JavaScript is disabled', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    for (const [id] of filters) {
      await page.goto(exampleUrl(id));
      const form = page.locator('form[data-publishing-filter]');
      await expect(form.locator('button[type=submit]'), id).toBeDisabled();
      await expect(form.locator('[data-publishing-reset]'), id).toBeDisabled();
      await expect(form.locator('noscript p'), id).toContainText('this form cannot submit your query');
      await expect(form.locator('noscript p'), id).toBeVisible();
      await expect(page.locator('[data-publishing-record]:visible'), id).toHaveCount(3);
      const requests = [];
      const track = request => requests.push(request.url());
      const initialUrl = page.url();
      page.on('request', track);
      try {
        await form.locator('[name=query]').fill('private-example-query');
        await form.locator('[name=query]').press('Enter');
        // Allow an unintended native GET navigation to start before checking.
        await page.waitForTimeout(100);
        await expect(page, id).toHaveURL(initialUrl);
        expect(requests, `${id}: no-JS Enter must not send the field value`).toEqual([]);
      } finally {
        page.off('request', track);
      }
    }
  } finally {
    await context.close();
  }
});

test('print examples invoke only the browser print action after activation', async ({ page, browser, baseURL }) => {
  expect(printExamples).toHaveLength(2);
  await page.addInitScript(() => {
    window.publishingPrintCalls = 0;
    window.print = () => { window.publishingPrintCalls++; };
  });
  for (const [id] of printExamples) {
    await page.goto(exampleUrl(id));
    await expect(page.locator('[data-publishing-print]'), id).toBeEnabled();
    expect(await page.evaluate(() => window.publishingPrintCalls), `${id}: no automatic print`).toBe(0);
    await page.getByRole('button', { name: 'Print this example', exact: true }).click();
    expect(await page.evaluate(() => window.publishingPrintCalls), id).toBe(1);
    await expect(page.locator('#print-status'), id).toHaveText('Opening the browser print dialog for this example. No file is uploaded.');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-publishing-print]'), id).toBeHidden();
    await expect(page.locator('.c-example-canvas h2').first(), id).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  }
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const nojs = await context.newPage();
    for (const [id] of printExamples) {
      await nojs.goto(exampleUrl(id));
      await expect(nojs.locator('[data-publishing-print]'), id).toBeDisabled();
      await expect(nojs.locator('noscript p'), id).toContainText('Use your browser’s Print command');
      await expect(nojs.locator('noscript p'), id).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
