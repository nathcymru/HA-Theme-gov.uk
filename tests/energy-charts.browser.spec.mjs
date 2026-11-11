import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openExamples(page) {
  await page.goto('/ui/dev/energy-charts.html');
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(4);
  await expect(page.locator('ha-chart-base svg')).toHaveCount(4);
}
async function openTable(page, title) {
  await page.getByLabel(`View data for ${title}`, { exact: true }).click();
  return page.getByRole('table', { name: `${title} — chart values`, exact: true });
}

test('real ECharts receives ONS presentation while data, native legend, zoom and tooltip survive', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openExamples(page);
  await page.evaluate(() => {
    const f = window.energyFixture; f.setActive(false);
    window.originalEnergyData = f.hosts.power.data;
    window.originalEnergyOptions = f.hosts.power.options;
    window.originalEnergyDataText = JSON.stringify(f.hosts.power.data);
    window.originalEnergyTooltip = f.hosts.power.options.tooltip.formatter;
    window.energyFinishedCount = 0; f.hosts.power.chart.on('finished', () => window.energyFinishedCount++);
    f.setActive(true);
  });
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(3);
  const state = await page.evaluate(() => {
    const host = window.energyFixture.hosts.power, option = host.chart.getOption();
    return {
      family: option.textStyle.fontFamily, axisFont: option.yAxis[0].axisLabel.fontSize,
      gridWidth: option.yAxis[0].splitLine.lineStyle.width,
      zeroWidth: option.xAxis[0].axisLine.lineStyle.width,
      sameData: host.data === window.originalEnergyData && JSON.stringify(host.data) === window.originalEnergyDataText,
      sameOptions: host.options === window.originalEnergyOptions,
      sameTooltip: option.tooltip[0].formatter === window.originalEnergyTooltip,
      nativeGap: option.series[0].connectNulls,
    };
  });
  expect(state).toEqual({ family: 'Arial, Helvetica, sans-serif', axisFont: 14, gridWidth: 1, zeroWidth: 1.5, sameData: true, sameOptions: true, sameTooltip: true, nativeGap: false });
  await page.getByRole('button', { name: 'Show Grid power', exact: true }).click();
  expect(await page.evaluate(() => window.energyFixture.nativeClicks)).toContain('Grid power');
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().legend[0].selected['Grid power'])).toBe(false);
  await page.evaluate(() => window.energyFixture.hosts.power.chart.setOption({ dataZoom: [{ type: 'inside', start: 10, end: 80 }] }));
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().dataZoom[0].start)).toBe(10);
  await page.waitForTimeout(150); // A finished-event repaint must settle, not feed an endless render loop.
  expect(await page.evaluate(() => window.energyFinishedCount)).toBeLessThan(12);
  expect(errors).toEqual([]);
});

test('data tables retain comparison dates, signed power, zero, missing values and device names', async ({ page }) => {
  await openExamples(page);
  const usage = await openTable(page, 'Hourly energy use');
  await expect(usage.getByRole('columnheader', { name: 'Period start', exact: true })).toBeVisible();
  const comparison = usage.getByRole('row').filter({ hasText: 'Grid energy (comparison)' });
  await expect(comparison).toHaveCount(3);
  for (const row of await comparison.all()) { await expect(row).toContainText('10 Nov 2026'); await expect(row).toContainText('kWh'); }
  const current = usage.getByRole('row').filter({ hasText: 'Grid energy' }).filter({ hasText: '11 Nov 2026' });
  await expect(current).toHaveCount(3);
  await expect(current.nth(1).getByRole('cell', { name: '0', exact: true })).toBeVisible();
  const power = await openTable(page, 'Power over time');
  await expect(power.getByRole('columnheader', { name: 'Time', exact: true })).toBeVisible();
  await expect(power.getByRole('cell', { name: '-160', exact: true })).toBeVisible();
  await expect(power.getByRole('cell', { name: 'Not available', exact: true })).toBeVisible();
  await expect(power.getByRole('cell', { name: 'W', exact: true })).toHaveCount(12);
  const devices = await openTable(page, 'Energy used by devices');
  await expect(devices.getByRole('columnheader', { name: 'Device', exact: true })).toBeVisible();
  await expect(devices.getByRole('cell', { name: 'Washing machine', exact: true })).toBeVisible();
  await expect(devices.getByRole('cell', { name: 'Robot vacuum', exact: true })).toBeVisible();
  await expect(devices).not.toContainText('sensor.example');
  await page.getByLabel('View data for Gas use — no data', { exact: true }).click();
  await expect(page.getByText('No chart values are available for the selected period.', { exact: true })).toBeVisible();
});

test('dense tables paginate every value and refresh without retaining an old date range', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const t = Date.UTC(2026, 10, 11);
    window.energyFixture.replaceData('usage', [{ type: 'bar', id: 'dense', name: '<Example series>', data: Array.from({ length: 251 }, (_, i) => [t + i * 60000, i === 2 ? null : i, t + i * 60000]) }]);
  });
  const table = await openTable(page, 'Hourly energy use');
  const section = page.locator('hui-energy-usage-graph-card .civica-energy-data');
  await expect(table.getByRole('row')).toHaveCount(101);
  await expect(section.getByRole('status')).toHaveText('Rows 1 to 100 of 251');
  await section.getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(section.getByRole('status')).toHaveText('Rows 101 to 200 of 251');
  await section.getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(52);
  await expect(section.getByRole('status')).toHaveText('Rows 201 to 251 of 251');
  await expect(section.getByRole('button', { name: 'Next rows', exact: true })).toBeDisabled();
  await page.evaluate(() => window.energyFixture.replaceData('usage', [{ type: 'bar', id: 'new-day', name: 'New date range', data: [[Date.UTC(2026, 10, 12), .125, Date.UTC(2026, 10, 12)]] }]));
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('12 Nov 2026');
  await expect(table).not.toContainText('<Example series>');
  await expect(section.getByRole('status')).toHaveText('Rows 1 to 1 of 1');
});

test('the data table distinguishes repeated local times across the autumn clock change', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => window.energyFixture.replaceData('power', [{ type: 'line', id: 'clock-change', name: 'Grid power', data: [[Date.UTC(2026, 9, 25, 0, 30), 100], [Date.UTC(2026, 9, 25, 1, 30), 110]] }]));
  const table = await openTable(page, 'Power over time');
  const times = await table.locator('tbody tr td:first-of-type').allTextContents();
  expect(times[0]).toContain('01:30 GMT+1'); expect(times[1]).toContain('01:30 GMT');
  expect(times[0]).not.toBe(times[1]);
});

test('table formatting follows independent HA number, clock and local timezone preferences', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    window.__haNativeTimeZone = 'America/New_York';
    window.energyFixture.setPreferences({ language: 'en-GB', number_format: 'decimal_comma', time_format: '12', time_zone: 'local' });
    window.energyFixture.replaceData('power', [{ type: 'line', id: 'preferences', name: 'Grid power', data: [[Date.UTC(2026, 10, 11, 18), 1234.5]] }]);
  });
  const table = await openTable(page, 'Power over time');
  await expect(table.getByRole('cell', { name: '1.234,5', exact: true })).toBeVisible();
  await expect(table).toContainText('1:00 pm GMT-5');
  await page.evaluate(() => window.energyFixture.setPreferences({ number_format: 'none', time_format: '24', time_zone: 'server' }));
  await expect(table.getByRole('cell', { name: '1234.5', exact: true })).toBeVisible();
  await expect(table).toContainText('18:00 GMT');
});

test('nested native heading, chart role and explicit plot height are preserved and restored', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const f = window.energyFixture; f.setActive(false);
    const card = f.cards.power, shell = card.shadowRoot.querySelector('ha-card');
    card.shadowRoot.querySelector('.card-header').remove();
    const shadow = shell.attachShadow({ mode: 'open' });
    const heading = document.createElement('h2'); heading.textContent = 'Nested native title';
    shadow.append(heading, document.createElement('slot')); shell.header = 'Nested native title';
    const host = f.hosts.power; host.height = '400px';
    const plot = host.shadowRoot.querySelector('.chart'); plot.setAttribute('aria-label', 'Chart'); plot.setAttribute('role', 'application'); plot.tabIndex = 0;
    f.setActive(true);
  });
  const plot = page.locator('hui-power-sources-graph-card .chart');
  await expect(plot).toHaveAttribute('aria-label', 'Nested native title. Chart');
  await expect(plot).toHaveAttribute('role', 'application');
  await expect(plot).toHaveAttribute('tabindex', '0');
  await expect.poll(() => page.locator('hui-power-sources-graph-card .chart-container').evaluate(el => el.getBoundingClientRect().height)).toBe(400);
  await openTable(page, 'Nested native title');
  await page.evaluate(() => window.energyFixture.setActive(false));
  await expect(plot).toHaveAttribute('aria-label', 'Chart');
  await expect(plot).toHaveAttribute('role', 'application');
  expect(await page.locator('hui-power-sources-graph-card ha-chart-base').evaluate(el => el.style.getPropertyValue('--civica-energy-native-height'))).toBe('');
});

for (const mode of ['light', 'dark']) test(`chart examples and keyboard tables reflow at 320px in ${mode} mode`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openExamples(page); await page.evaluate(mode => window.energyFixture.setMode(mode), mode);
  const summary = page.getByLabel('View data for Power over time', { exact: true });
  await summary.focus(); await page.keyboard.press('Enter');
  const table = page.getByRole('table', { name: 'Power over time — chart values', exact: true });
  await expect(table).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const region = page.getByRole('region', { name: 'Power over time data table — scroll to see all columns', exact: true });
  await region.focus(); await expect(region).toBeFocused();
  expect(await region.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('adapter restores native presentation and handles renderer replacement without changing latest values', async ({ page }) => {
  await openExamples(page);
  expect(await page.evaluate(() => window.energyFixture.hosts.devices.chart.getOption().series[0].data[0].itemStyle.borderRadius)).toBe(0);
  await page.evaluate(() => window.energyFixture.recreateChart('power'));
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(3);
  await page.getByRole('button', { name: 'Show next sample day', exact: true }).click();
  const table = await openTable(page, 'Power over time'); await expect(table).toContainText('12 Nov 2026');
  await page.evaluate(() => {
    window.latestEnergyValues = JSON.stringify(window.energyFixture.hosts.power.data);
    window.energyFixture.setActive(false);
  });
  await expect(page.locator('.civica-energy-data')).toHaveCount(0);
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(0);
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(1.5);
  expect(await page.evaluate(() => window.energyFixture.hosts.devices.chart.getOption().series[0].data[0].itemStyle.borderRadius)).toEqual([0, 6, 6, 0]);
  expect(await page.evaluate(() => JSON.stringify(window.energyFixture.hosts.power.data) === window.latestEnergyValues)).toBe(true);
  await page.evaluate(() => window.energyFixture.setActive(true));
  await expect(page.locator('.civica-energy-data')).toHaveCount(4);
  await openTable(page, 'Power over time');
  await expect(page.getByRole('table', { name: 'Power over time — chart values', exact: true })).toContainText('12 Nov 2026');
});

test('positive-only and negative-only domains never gain a misleading zero baseline', async ({ page }) => {
  await openExamples(page);
  for (const [min, max, onZero] of [[100, 500, true], [-500, -100, true], [-500, 500, false]]) {
    await page.evaluate(({ min, max, onZero }) => {
      const f = window.energyFixture, host = f.hosts.power;
      f.replaceData('power', host.data, { ...host.options, xAxis: { ...host.options.xAxis, axisLine: { onZero } }, yAxis: { type: 'value', name: 'W', min, max } });
    }, { min, max, onZero });
    await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().xAxis[0].axisLine.lineStyle.width)).toBe(1);
    const bounds = await page.evaluate(() => {
      const options = window.energyFixture.hosts.power.chart.getOption();
      return [options.yAxis[0].min, options.yAxis[0].max, options.xAxis[0].axisLine.onZero];
    });
    expect(bounds).toEqual([min, max, onZero]);
  }
});

test('a disposed renderer releases its table and owned accessibility styling until replacement', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const f = window.energyFixture; f.setActive(false);
    f.hosts.power.shadowRoot.querySelector('.chart').setAttribute('aria-label', 'Chart');
    f.setActive(true);
  });
  const plot = page.locator('hui-power-sources-graph-card .chart');
  await expect(plot).toHaveAttribute('aria-label', 'Power over time. Chart');
  await page.evaluate(() => { const f = window.energyFixture; f.hosts.power.chart.dispose(); f.refresh(); });
  await expect(page.locator('hui-power-sources-graph-card .civica-energy-data')).toHaveCount(0);
  await expect(page.locator('hui-power-sources-graph-card [data-civica-energy-chart]')).toHaveCount(0);
  await expect(plot).toHaveAttribute('aria-label', 'Chart');
  expect(await page.locator('hui-power-sources-graph-card ha-chart-base').evaluate(el => el.shadowRoot.adoptedStyleSheets.length)).toBe(0);
  await page.evaluate(() => window.energyFixture.recreateChart('power'));
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(4);
  await expect(plot).toHaveAttribute('aria-label', 'Power over time. Chart');
  await openTable(page, 'Power over time');
});
