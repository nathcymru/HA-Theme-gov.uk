import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { chartColour, chartSeriesStyle, chartContrast } from '../design-system/chart-colours.mjs';

const readExamples = name => YAML.parse(readFileSync(`docs/data/${name}-examples.yml`, 'utf8')).examples;
const colours = readExamples('data-colour');
const dashboards = readExamples('dashboard-data');
const identities = readExamples('personalisation');
const palettes = JSON.parse(readFileSync('design-system/palettes.json', 'utf8')).palettes;
const exampleUrl = id => `/docs/build/examples/${id}.html`;
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(channel => parseInt(channel, 16)).join(', ')})`;
const clean = text => text.replace(/\s+/g, ' ').trim();
const numeric = text => Number(text.replace('−', '-'));
const interpolate = (start, end, position) => {
  const channels = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16));
  const from = channels(start), to = channels(end);
  return `#${from.map((value, index) => Math.round(value + position * (to[index] - value)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};
const tableRows = table => table.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('th,td')].map(cell => cell.textContent.replace(/\s+/g, ' ').trim())));

// The guide-wide suite covers general accessibility and source rendering. These
// checks own the numerical meaning and the separation of colour from identity.
test('categorical references use the existing generator in all four display contexts', async ({ page }) => {
  const reference = colours['data-colour-categorical'].colour_reference;
  expect(createHash('sha256').update(readFileSync(reference.generator)).digest('hex')).toBe(reference.generator_sha256);
  expect(reference.contexts.map(context => `${context.tone}/${context.mode}`).sort()).toEqual(['muted/dark', 'muted/light', 'vivid/dark', 'vivid/light']);
  await page.goto(exampleUrl('data-colour-categorical'));
  await expect(page.locator('[data-chart-key]')).toHaveCount(reference.series.length * reference.contexts.length);
  for (const context of reference.contexts) {
    expect(context.series.map(series => series.key)).toEqual(reference.series.map(series => series.key));
    for (const series of context.series) {
      const expected = chartSeriesStyle(series.key, { tone: context.tone, mode: context.mode });
      expect(series).toMatchObject(expected);
      expect(chartContrast(expected.color, context.surface)).toBeGreaterThanOrEqual(3);
      const key = page.locator(`[data-chart-key="${series.key}"][data-chart-tone="${context.tone}"][data-chart-mode="${context.mode}"]`);
      await expect(key).toContainText(series.label);
      await expect(key.locator('.c-data-colour-code')).toHaveText(expected.color);
      await expect(key).toHaveAttribute('data-chart-pattern', expected.pattern);
      await expect(key).toHaveAttribute('data-chart-symbol', expected.symbol);
      await expect(key).toHaveAttribute('data-chart-line-dash', expected.lineDash.join(','));
      await expect(key.locator('svg line')).toHaveAttribute('stroke', expected.color);
      await expect(key.locator('svg line')).toHaveAttribute('stroke-width', '1.5');
      await expect(key.locator('svg line')).toHaveAttribute('stroke-dasharray', expected.lineDash.join(' '));
      await expect(key.locator('svg line')).toHaveCSS('opacity', '1');
    }
  }
  const rows = await tableRows(page.getByRole('table'));
  expect(rows.map(row => row[1])).toEqual(reference.series.map(series => series.value === null ? 'Not supplied' : String(series.value)));
  expect(rows.find(row => row[0].includes('Dishwasher'))[2]).toContain('not zero');
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('quantitative scales calculate values, retain their units and keep missing distinct from zero', async ({ page }) => {
  const reference = colours['data-colour-quantitative'].colour_reference;
  await page.goto(exampleUrl('data-colour-quantitative'));
  for (const name of ['sequential', 'divergent']) {
    const scale = reference[name];
    const table = page.getByRole('table', { name: `The ${name} colours and their underlying values` });
    const renderedRows = await tableRows(table);
    expect(renderedRows).toHaveLength(scale.rows.length);
    await expect(table.locator('thead')).toContainText(name === 'sequential' ? 'Energy (kWh)' : 'Difference (°C)');
    for (const [index, row] of scale.rows.entries()) {
      const swatch = page.locator(`[data-scale="${name}"][data-scale-value="${row.value ?? 'missing'}"]`);
      expect(renderedRows[index][0]).toBe(row.label);
      if (row.value === null) {
        expect(row.color).toBeNull();
        await expect(swatch).toHaveAttribute('data-scale-colour', 'none');
        await expect(swatch).toContainText('Not supplied');
        await expect(swatch.locator('.c-data-colour-fill svg')).toBeVisible();
        const missingFill = await swatch.locator('.c-data-colour-fill').evaluate(node => getComputedStyle(node).backgroundColor);
        expect(scale.rows.filter(sample => sample.color !== null).map(sample => rgb(sample.color))).not.toContain(missingFill);
        expect(renderedRows[index].slice(1).every(cell => cell.startsWith('Not supplied'))).toBe(true);
        continue;
      }
      const expected = name === 'sequential'
        ? interpolate(scale.start, scale.end, (row.value - scale.minimum) / (scale.maximum - scale.minimum))
        : row.value <= scale.centre
          ? interpolate(scale.negative, scale.neutral, (row.value - scale.minimum) / (scale.centre - scale.minimum))
          : interpolate(scale.neutral, scale.positive, (row.value - scale.centre) / (scale.maximum - scale.centre));
      expect(row.color).toBe(expected);
      await expect(swatch).toHaveAttribute('data-scale-colour', expected);
      await expect(swatch.locator('.c-data-colour-fill')).toHaveCSS('background-color', rgb(expected));
      await expect(swatch.locator('.c-data-colour-fill')).toHaveCSS('opacity', '1');
      expect(renderedRows[index].at(-1)).toBe(expected);
      expect(numeric(renderedRows[index][name === 'sequential' ? 1 : 2])).toBe(row.value);
      if (name === 'divergent') {
        expect(numeric(renderedRows[index][1])).toBe(row.measurement);
        expect(row.measurement - scale.target_temperature).toBe(row.value);
      }
    }
  }
  await expect(page.locator('.c-example-canvas')).toContainText('outside this scale');
  await expect(page.locator('.c-example-canvas')).toContainText('no more than two quantitative colour scales');
});

test('electricity dashboard columns, table and partial total describe the same six intervals', async ({ page }) => {
  const data = dashboards['dashboard-data-electricity-monitor'].chart_data;
  const known = data.values.filter(value => value !== null);
  expect(data.known_interval_sum).toBeCloseTo(known.reduce((sum, value) => sum + value, 0), 10);
  expect(data.known_interval_count).toBe(known.length);
  expect(data.expected_interval_count).toBe(data.values.length);
  expect((Date.parse(data.period_end) - Date.parse(data.period_start)) / 3_600_000).toBe(data.values.length);
  expect(data.colour).toBe(chartColour(data.source_identity, { tone: 'vivid', mode: 'light' }));
  await page.goto(exampleUrl('dashboard-data-electricity-monitor'));
  const rows = await tableRows(page.getByRole('table'));
  expect(rows.map(row => row[1])).toEqual(data.values.map(value => value === null ? 'Not supplied' : value.toFixed(2)));
  expect(rows.map(row => row[2])).toEqual(data.values.map(value => value === null ? 'Missing interval' : 'Complete interval'));
  const bars = await page.locator('.civica-data-dashboard__bars rect').evaluateAll(nodes => nodes.map(node => ({
    x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), height: Number(node.getAttribute('height')),
    fill: getComputedStyle(node).fill, opacity: getComputedStyle(node).opacity,
  })));
  expect(bars).toHaveLength(known.length);
  let column = 0;
  for (const [index, value] of data.values.entries()) {
    if (value === null) { expect(bars.some(bar => bar.x === 78 + 90 * index)).toBe(false); continue; }
    const bar = bars[column++];
    expect(bar.x).toBe(78 + 90 * index);
    expect(bar.height / 300).toBeCloseTo(value, 10);
    expect(bar.y + bar.height).toBe(260);
    expect(bar.fill).toBe(rgb(data.colour));
    expect(bar.opacity).toBe('1');
  }
  const metrics = page.locator('.civica-data-dashboard__metrics');
  await expect(metrics).toContainText(`${data.known_interval_sum.toFixed(2)} kWh`);
  await expect(metrics).toContainText(`${known.length} of ${data.values.length}`);
  await expect(metrics).toContainText('The full period total is unknown');
  await expect(page.locator('.civica-data-dashboard')).toContainText('not current power readings');
  await expect(page.locator(`time[datetime="${data.reported_at}"]`)).toBeVisible();
  await page.getByRole('link', { name: 'Check the source and missing coverage' }).click();
  await expect(page).toHaveURL(/#electricity-source$/);
  await expect(page.locator('#electricity-source')).toBeInViewport();
});

test('room report coverage excludes old readings without erasing them or treating unconfigured rooms as zero', async ({ page }) => {
  await page.goto(exampleUrl('dashboard-data-room-report'));
  const rows = page.locator('.civica-data-dashboard__room-list > div');
  const records = await rows.evaluateAll(nodes => nodes.map(node => ({
    name: node.querySelector('dt').textContent.trim(), text: node.querySelector('dd').textContent.replace(/\s+/g, ' ').trim(),
    time: node.querySelector('time')?.getAttribute('datetime') ?? null,
  })));
  expect(records.map(record => record.name)).toEqual(['Kitchen', 'Study', 'Bedroom', 'Garden room']);
  const end = Date.parse('2026-11-12T12:00:00+00:00'), start = end - 5 * 60_000;
  const configured = records.filter(record => record.time !== null);
  const recent = configured.filter(record => Date.parse(record.time) >= start && Date.parse(record.time) <= end);
  expect(configured).toHaveLength(3);
  expect(recent.map(record => record.name)).toEqual(['Kitchen', 'Study']);
  await expect(page.locator('.civica-data-dashboard')).toContainText(`${recent.length} of ${configured.length} configured sensors`);
  const readings = recent.map(record => Number(record.text.match(/([\d.]+) °C/)[1]));
  expect(readings[0] - readings[1]).toBeCloseTo(0.7, 10);
  expect(Math.abs(Date.parse(recent[0].time) - Date.parse(recent[1].time))).toBe(60_000);
  expect(records[2].text).toContain('Last supplied value: 21.0 °C');
  expect(records[2].text).toContain('temperature at 12:00 is unknown');
  expect(records[3].time).toBeNull();
  expect(records[3].text).toContain('No temperature sensor configured');
  expect(records[3].text).toContain('not a zero temperature or evidence of a device failure');
  await page.getByRole('link', { name: 'Read the bedroom record' }).click();
  await expect(page).toHaveURL(/#room-report-bedroom$/);
  await expect(page.locator('#room-report-bedroom')).toBeInViewport();
});

test('optional household identity keeps its text and real home link without requiring project artwork', async ({ page }) => {
  await page.goto('/docs/build/get-started/personalisation.html');
  const guide = page.locator('main');
  await expect(guide).toContainText('not new theme settings');
  await expect(guide).toContainText('has not been implemented');
  await expect(guide).toContainText('current companion still inserts civica.uk artwork');
  expect(Object.keys(identities)).toHaveLength(3);
  for (const id of Object.keys(identities)) {
    await page.goto(exampleUrl(id));
    const canvas = page.locator('.c-example-canvas');
    const home = canvas.locator('header a');
    const name = id === 'identity-business-name' ? 'Example workshop' : 'Morgan household';
    await expect(home).toHaveAccessibleName(name);
    await expect(home).toHaveText(name);
    await expect(canvas.locator('button,input,select,textarea')).toHaveCount(0);
    await expect(canvas.locator('img[src*="civica"], header img')).toHaveCount(0);
    const illustrations = home.locator('svg');
    for (const illustration of await illustrations.all()) await expect(illustration).toHaveAttribute('aria-hidden', 'true');
    // Model the image being unavailable: the name and navigation must survive.
    await illustrations.evaluateAll(nodes => nodes.forEach(node => node.remove()));
    await expect(home).toHaveAccessibleName(name);
    await home.focus();
    await home.press('Enter');
    await expect(page).toHaveURL(new RegExp(`#${id}-home$`));
    await expect(page.locator(`main[id="${id}-home"]`)).toBeInViewport();
  }
});

test('all twenty palette previews change only interface colours and retain household identity and state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/docs/build/styles/colour.html');
  const demo = page.locator('[data-palette-demo]');
  const select = demo.getByLabel('Colour palette');
  const muted = demo.getByLabel('Muted colours');
  const header = demo.locator('.c-demo__header');
  const state = clean(await demo.locator('.c-status').textContent());
  const shell = page.locator('.c-header');
  const shellIdentity = await shell.textContent();
  const shellColour = await shell.evaluate(node => getComputedStyle(node).backgroundColor);
  await expect(select.locator('option')).toHaveCount(palettes.length);
  const requests = [];
  const track = request => requests.push(request.url());
  page.on('request', track);
  try {
    for (const palette of palettes) {
      await select.selectOption({ label: palette.name });
      for (const tone of ['vivid', 'muted']) {
        await muted.setChecked(tone === 'muted');
        await expect(header).toHaveCSS('background-color', rgb(palette[tone].primary.hex));
        await expect(demo).toHaveCSS('background-color', rgb(palette[tone].canvas.hex));
        await expect(header).toHaveText('Morgan household');
        await expect(header.locator('img,svg')).toHaveCount(0);
        await expect(demo.locator('.c-status')).toHaveText(state);
        await expect(demo.getByRole('status')).toHaveText(`${palette.name}, ${tone === 'muted' ? 'Muted' : 'Vivid'} preview. These choices affect this example only.`);
        await expect(shell).toHaveCSS('background-color', shellColour);
        expect(await shell.textContent()).toBe(shellIdentity);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    }
    expect(requests, 'The documentation colour preview must not fetch identity artwork or call a backend').toEqual([]);
  } finally { page.off('request', track); }
});

test('data meanings and identity remain available without JavaScript at a narrow width', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 }, baseURL });
  const page = await context.newPage();
  try {
    for (const id of ['data-colour-categorical', 'data-colour-quantitative', 'dashboard-data-electricity-monitor', 'dashboard-data-room-report', 'identity-household-name']) {
      await page.goto(exampleUrl(id));
      await expect(page.locator('.c-example-canvas')).toBeVisible();
      if (id === 'data-colour-categorical') await expect(page.getByRole('table')).toContainText('Not supplied');
      if (id === 'data-colour-quantitative') {
        await expect(page.getByRole('table')).toHaveCount(2);
        await expect(page.locator('[data-scale-value="missing"]')).toHaveCount(2);
      }
      if (id === 'dashboard-data-electricity-monitor') await expect(page.getByRole('table')).toContainText('Not supplied');
      if (id === 'dashboard-data-room-report') await expect(page.locator('.civica-data-dashboard__room-list > div')).toHaveCount(4);
      if (id === 'identity-household-name') await expect(page.getByRole('link', { name: 'Morgan household' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id).toBe(true);
    }
  } finally { await context.close(); }
});
