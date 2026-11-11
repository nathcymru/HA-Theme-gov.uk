import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openExamples(page) {
  await page.goto('/ui/dev/energy-charts.html');
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(5);
  await expect(page.locator('ha-chart-base .chart canvas')).toHaveCount(5);
}
async function openTable(page, title) {
  await page.getByLabel(`View data for ${title}`, { exact: true }).click();
  const table = page.getByRole('table', { name: `${title} — chart values`, exact: true });
  await expect(table).toBeVisible();
  return table;
}

test('sample date changes cross month boundaries and fixed examples have no no-op date control', async ({ page }) => {
  await openExamples(page);
  const next = page.getByRole('button', { name: 'Show next sample day for time charts', exact: true });
  // Advance synchronously to avoid waiting on twenty decorative animations.
  await next.evaluate(button => { for (let index = 0; index < 20; index++) button.click(); });
  await expect(page.locator('hui-power-sources-graph-card .chart-description')).toContainText('1 December 2026');
  await expect(page.locator('hui-energy-usage-graph-card .chart-description')).toContainText('compared with 30 November 2026');
  await page.getByRole('checkbox', { name: 'Muted chart colours' }).check();
  await expect(page.locator('hui-power-sources-graph-card .chart-description')).toContainText('1 December 2026');
  for (const id of ['local-chart-devices', 'local-chart-empty']) {
    await page.goto(`/docs/build/examples/${id}.html`);
    await expect(page.getByRole('button', { name: /Show next sample day/ })).toHaveCount(0);
    await expect(page.locator('.chart-description')).toContainText('Fixed example');
  }
  await page.goto('/docs/build/examples/local-chart-power.html');
  await page.getByRole('button', { name: 'Show next sample day', exact: true }).evaluate(button => { for (let index = 0; index < 137; index++) button.click(); });
  await expect(page.locator('.chart-description')).toContainText('28 March 2027, from 00:00 GMT to 04:00 BST');
});

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
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(1.5);
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
  await page.locator('hui-power-sources-graph-card .legend-toggle[data-id=grid]').click();
  expect(await page.evaluate(() => window.energyFixture.nativeClicks)).toContain('grid');
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.filter(series => ['grid', 'grid-negative'].includes(series.id)).every(series => !series.data?.length))).toBe(true);
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
  await expect(power.getByRole('cell', { name: '-0.16', exact: true })).toBeVisible();
  await expect(power.getByRole('cell', { name: 'Not available', exact: true })).toHaveCount(2);
  await expect(power.getByRole('cell', { name: 'kW', exact: true })).toHaveCount(24);
  const devices = await openTable(page, 'Energy used by devices');
  await expect(devices.getByRole('columnheader', { name: 'Device', exact: true })).toBeVisible();
  await expect(devices.getByRole('cell', { name: 'Washing machine', exact: true })).toHaveCount(2);
  await expect(devices.getByRole('cell', { name: 'Robot vacuum', exact: true })).toHaveCount(2);
  await expect(devices).not.toContainText('sensor.');
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
  await expect(table.locator('tbody tr')).toHaveCount(2);
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
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(1.5);
  await page.getByRole('button', { name: 'Show next sample day for time charts', exact: true }).click();
  const table = await openTable(page, 'Power over time'); await expect(table).toContainText('12 Nov 2026');
  await page.evaluate(() => {
    window.latestEnergyValues = JSON.stringify(window.energyFixture.hosts.power.data);
    window.energyFixture.setActive(false);
  });
  await expect(page.locator('.civica-energy-data')).toHaveCount(0);
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(0);
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series[0].lineStyle.width)).toBe(1);
  expect(await page.evaluate(() => window.energyFixture.hosts.devices.chart.getOption().series[0].data[0].itemStyle.borderRadius)).toEqual([0, 6, 6, 0]);
  expect(await page.evaluate(() => JSON.stringify(window.energyFixture.hosts.power.data) === window.latestEnergyValues)).toBe(true);
  await page.evaluate(() => window.energyFixture.setActive(true));
  await expect(page.locator('.civica-energy-data')).toHaveCount(5);
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
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(5);
  await expect(plot).toHaveAttribute('aria-label', 'Power over time. Chart');
  await openTable(page, 'Power over time');
});

// Unlike the first version of the examples, these preconditions deliberately
// contain native gradients, transparent paints, stacks and per-point overrides.
// A good-looking hand-authored line chart would not exercise these regressions.
test('native source-shaped Canvas charts converge to the shared presentation without replacing source data', async ({ page }) => {
  await page.goto('/ui/dev/energy-charts.html?native');
  const baseline = await page.evaluate(() => {
    const f = window.energyFixture;
    window.nativeSourceReferences = Object.fromEntries(Object.entries(f.hosts).map(([key, host]) => [key, { data: host.data, options: host.options, text: JSON.stringify(host.data), optionsText: JSON.stringify(host.options) }]));
    window.nativePatchCounts = {}; window.nativePatchFailures = [];
    for (const [key, host] of Object.entries(f.hosts)) {
      const set = host.chart.setOption.bind(host.chart); window.nativePatchCounts[key] = 0;
      host.chart.setOption = (patch, flags) => {
        if (++window.nativePatchCounts[key] > 12) { window.nativePatchFailures.push(key); throw Error(`Presentation did not converge: ${key}`); }
        return set(patch, flags);
      };
    }
    const power = f.hosts.power.data;
    return { renderer: f.renderer, frontend: f.frontend, power: power.map(series => ({ id: series.id, width: series.lineStyle.width, stack: series.stack, smooth: series.smooth, gradient: !!series.areaStyle?.color?.colorStops })),
      current: f.hosts.usage.data.find(series => series.id === 'grid-from_grid').color,
      compare: f.hosts.usage.data.find(series => series.id === 'compare-grid-from_grid').color,
      point: f.hosts.devices.data[0].data[0].itemStyle.color, count: f.manyDevices.length };
  });
  expect(baseline.renderer).toBe('canvas'); expect(baseline.frontend).toBe('20261028.5'); expect(baseline.count).toBe(24);
  expect(baseline.power.slice(0, 5).every(series => series.width === 1 && series.smooth === .4 && series.gradient)).toBe(true);
  expect(baseline.power.slice(0, 5).map(series => series.stack)).toEqual(['positive', 'positive', 'positive', 'negative', 'negative']);
  expect(baseline.power[5].width).toBe(1.5);
  expect(baseline.current).toMatch(/^#[\dA-F]{6}7F$/i); expect(baseline.compare).toMatch(/^#[\dA-F]{6}32$/i); expect(baseline.point).toMatch(/^#[\dA-F]{6}7F$/i);
  await page.evaluate(() => window.energyFixture.setActive(true));
  await expect(page.locator('[data-civica-energy-chart]')).toHaveCount(5);
  await page.waitForTimeout(250); // Rendering must settle after ECharts normalises decal defaults.
  const active = await page.evaluate(() => {
    const f = window.energyFixture, power = f.hosts.power.chart;
    const shapes = power.getZr().storage.getDisplayList().filter(shape => shape.type === 'ec-polyline' || shape.type === 'ec-polygon');
    return { failures: window.nativePatchFailures, counts: Object.values(window.nativePatchCounts),
      sourcesUntouched: Object.entries(f.hosts).every(([key, host]) => host.data === window.nativeSourceReferences[key].data && host.options === window.nativeSourceReferences[key].options && JSON.stringify(host.data) === window.nativeSourceReferences[key].text && JSON.stringify(host.options) === window.nativeSourceReferences[key].optionsText),
      lines: shapes.filter(shape => shape.type === 'ec-polyline' && shape.shape.points.length > 0).map(shape => ({ width: shape.style.lineWidth, opacity: shape.style.opacity, fill: shape.style.fill, smooth: shape.shape.smooth, stroke: shape.style.stroke })),
      areas: shapes.filter(shape => shape.type === 'ec-polygon').length,
      unstacked: power.getOption().series.every(series => !series.stack && !series.areaStyle && series.smooth === false),
    };
  });
  expect(active.failures).toEqual([]); expect(active.counts.every(count => count < 6)).toBe(true); expect(active.sourcesUntouched).toBe(true);
  expect(active.lines).toHaveLength(4); expect(active.areas).toBe(0); expect(active.unstacked).toBe(true);
  for (const line of active.lines) { expect(line).toMatchObject({ width: 1.5, opacity: 1, fill: 'none', smooth: 0 }); expect(line.stroke).toMatch(/^#[\dA-F]{6}$/i); }
});

test('Canvas paint, hover lines, native legend keys and tooltip swatches use the same opaque colours', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const power = window.energyFixture.hosts.power.chart;
    power.dispatchAction({ type: 'highlight', seriesId: 'solar' });
  });
  await page.waitForTimeout(100);
  const power = await page.evaluate(() => {
    const f = window.energyFixture, host = f.hosts.power;
    const lines = host.chart.getZr().storage.getDisplayList().filter(shape => shape.type === 'ec-polyline');
    return { lines: lines.map(line => ({ width: line.style.lineWidth, opacity: line.style.opacity })),
      key: [...host.shadowRoot.querySelectorAll('.legend-toggle')].map(button => ({ id: button.dataset.id, width: button.querySelector('.civica-chart-key line')?.getAttribute('stroke-width'), color: button.querySelector('.civica-chart-key line')?.getAttribute('stroke'), dash: button.querySelector('.civica-chart-key line')?.getAttribute('stroke-dasharray'), nativeIconHidden: getComputedStyle(button.querySelector('ha-svg-icon')).display === 'none' })),
      total: f.sharedStyle('consumption') };
  });
  expect(power.lines.every(line => line.width === 1.5 && line.opacity === 1)).toBe(true);
  for (const key of power.key) { expect(key.width).toBe('1.5'); expect(key.nativeIconHidden).toBe(true); expect(key.color).toMatch(/^#[\dA-F]{6}$/i); }
  expect(power.key.find(key => key.id === 'usage').dash).toBe(power.total.lineDash.join(' '));
  const paints = await page.evaluate(() => {
    const f = window.energyFixture;
    return ['usage', 'devices'].flatMap(key => f.hosts[key].chart.getModel().getSeries().flatMap(series => {
      const data = series.getData();
      return Array.from({ length: data.count() }, (_, index) => { const paint = data.getItemVisual(index, 'style'); return { key, id: series.id, color: paint.fill, opacity: paint.opacity, border: paint.lineWidth, decal: !!paint.decal }; });
    }));
  });
  for (const paint of paints) { expect(paint.color).toMatch(/^#[\dA-F]{6}$/i); expect(paint.opacity).toBe(1); expect(paint.border).toBe(0); }
  expect(paints.filter(paint => paint.id === 'compare-grid-from_grid').every(paint => paint.decal)).toBe(true);
  expect(paints.filter(paint => ['grid-from_grid', 'used_solar-used_solar', 'grid-to_grid'].includes(paint.id)).every(paint => !paint.decal)).toBe(true);
  const pixel = await page.evaluate(() => {
    const host = window.energyFixture.hosts.usage, chart = host.chart;
    const series = chart.getModel().getSeries().find(series => series.id === 'grid-from_grid');
    const rect = series.getData().getItemGraphicEl(0).shape;
    const canvas = host.shadowRoot.querySelector('.chart canvas'), scale = canvas.width / chart.getWidth();
    return [...canvas.getContext('2d').getImageData(Math.floor((rect.x + rect.width / 2) * scale), Math.floor((rect.y + rect.height / 2) * scale), 1, 1).data];
  });
  expect(pixel).toEqual([32, 96, 149, 255]); // Opaque shared grid colour, actually painted.
  await page.evaluate(() => window.energyFixture.hosts.devices.chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: 0 }));
  await expect.poll(() => page.evaluate(() => {
    const f = window.energyFixture, graphic = f.hosts.devices.chart.getModel().getSeriesByIndex(0).getData().getItemGraphicEl(0);
    return { fill: graphic.style.fill, opacity: graphic.style.opacity, expected: f.sharedColour('sensor.washing_machine_energy') };
  })).toEqual({ fill: await page.evaluate(() => window.energyFixture.sharedColour('sensor.washing_machine_energy')), opacity: 1, expected: await page.evaluate(() => window.energyFixture.sharedColour('sensor.washing_machine_energy')) });
  // Trigger the real Canvas tooltip. The native-shaped callback passes the
  // renderer's param.color into ha-chart-tooltip-marker's public colour input.
  await page.evaluate(() => { const chart = window.energyFixture.hosts.usage.chart; chart.dispatchAction({ type: 'showTip', seriesIndex: chart.getOption().series.findIndex(series => series.id === 'grid-from_grid'), dataIndex: 0 }); });
  const marker = page.locator('hui-energy-usage-graph-card .native-tooltip [data-series-id="grid-from_grid"] ha-chart-tooltip-marker');
  await expect(marker).toBeVisible();
  expect(await marker.evaluate(node => node.color)).toBe(await page.evaluate(() => window.energyFixture.sharedColour('grid-consumption')));
  expect(await marker.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(32, 96, 149)');
});

test('24 source identities keep shared colours and pattern keys across tone, mode, brand and ordering', async ({ page }) => {
  await openExamples(page);
  async function inspect() {
    return page.evaluate(() => {
      const f = window.energyFixture, host = f.hosts.many, series = host.chart.getOption().series;
      return f.manyDevices.map(({ key, name }) => {
        const current = series.find(item => item.name === name && !item.id.startsWith('compare-'));
        const previous = series.find(item => item.name === name && item.id.startsWith('compare-'));
        const nativeKey = [...host.shadowRoot.querySelectorAll('.legend-toggle')].find(button => button.dataset.id === current.id);
        return { key, expected: f.sharedStyle(key), current: current.itemStyle.color, previous: previous.itemStyle.color,
          keyColour: nativeKey?.querySelector('.civica-chart-key circle')?.getAttribute('fill'),
          smallChartColour: f.hosts.devices.chart.getOption().series[0].data.find(point => point.id === key)?.itemStyle.color,
          patterned: !!current.itemStyle.decal, patternKey: !!nativeKey?.querySelector('.civica-chart-key pattern'), comparisonPatterned: !!previous.itemStyle.decal };
      });
    });
  }
  const contexts = [];
  for (const mode of ['light', 'dark']) for (const tone of ['vivid', 'muted']) {
    await page.evaluate(({ mode, tone }) => { window.energyFixture.setMode(mode); window.energyFixture.setTone(tone); }, { mode, tone });
    await expect.poll(async () => (await inspect()).every(item => item.current === item.expected.color)).toBe(true);
    const result = await inspect(); contexts.push(result.map(item => item.current));
    expect(new Set(result.map(item => item.current)).size).toBe(24);
    for (const item of result) {
      expect(item.previous).toBe(item.current); expect(item.keyColour).toBe(item.current);
      if (item.smallChartColour) expect(item.smallChartColour).toBe(item.current);
      expect(item.patterned).toBe(item.expected.pattern !== 'solid'); expect(item.patternKey).toBe(item.patterned); expect(item.comparisonPatterned).toBe(true);
    }
  }
  expect(contexts[0]).not.toEqual(contexts[1]); expect(contexts[0]).not.toEqual(contexts[2]);
  const before = await inspect();
  await page.evaluate(() => window.energyFixture.setPalette('imperial-damson'));
  expect((await inspect()).map(item => item.current)).toEqual(before.map(item => item.current));
  await page.evaluate(() => {
    const f = window.energyFixture, data = f.hosts.many.data.slice().reverse().map((series, index) => series.name ? { ...series, id: series.id.replace(/-\d+$/, `-${index + 70}`) } : series);
    f.replaceData('many', data);
  });
  await expect.poll(async () => (await inspect()).map(item => item.current)).toEqual(before.map(item => item.current));
  await expect(page.locator('hui-energy-devices-detail-graph-card .civica-chart-key')).toHaveCount(24);
});

test('deactivation restores native gradients, point alpha and legend icons after renderer normalisation', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const f = window.energyFixture;
    window.nativeSnapshots = Object.fromEntries(Object.entries(f.hosts).map(([key, host]) => [key, { data: host.data, options: host.options, text: JSON.stringify(host.data), optionsText: JSON.stringify(host.options) }]));
    f.setActive(false);
  });
  const restored = await page.evaluate(() => {
    const f = window.energyFixture, power = f.hosts.power.chart.getOption().series;
    return {
      sourcePreserved: Object.entries(f.hosts).every(([key, host]) => host.data === window.nativeSnapshots[key].data && host.options === window.nativeSnapshots[key].options && JSON.stringify(host.data) === window.nativeSnapshots[key].text && JSON.stringify(host.options) === window.nativeSnapshots[key].optionsText),
      power: power.slice(0, 5).every(series => series.lineStyle.width === 1 && series.smooth === .4 && series.stack && series.areaStyle.color.colorStops.length === 2),
      powerAreas: f.hosts.power.chart.getZr().storage.getDisplayList().filter(shape => shape.type === 'ec-polygon').length,
      bars: ['usage', 'devices', 'many'].flatMap(key => f.hosts[key].chart.getModel().getSeries().flatMap(series => { const data = series.getData(); return Array.from({ length: data.count() }, (_, index) => { const style = data.getItemVisual(index, 'style'); return { fill: style.fill, decal: !!style.decal }; }); })),
      iconVisible: [...f.hosts.power.shadowRoot.querySelectorAll('ha-svg-icon')].every(icon => getComputedStyle(icon).display !== 'none'),
    };
  });
  expect(restored.sourcePreserved).toBe(true); expect(restored.power).toBe(true); expect(restored.powerAreas).toBe(5); expect(restored.iconVisible).toBe(true);
  expect(restored.bars.every(paint => /^#[\dA-F]{6}(7F|32)$/i.test(paint.fill) && !paint.decal)).toBe(true);
  await expect(page.locator('.civica-chart-key')).toHaveCount(0);
});

test('verified Power sign pairs give one signed line, tooltip and table across hidden sources and date updates', async ({ page }) => {
  await openExamples(page);
  const state = await page.evaluate(() => {
    const f = window.energyFixture, host = f.hosts.power, rendered = host.chart.getOption().series;
    window.powerNativeReference = host.data; window.powerNativeText = JSON.stringify(host.data);
    const values = id => rendered.find(series => series.id === id).data.map(point => (point.value ?? point)[1]);
    return { grid: values('grid'), negative: values('grid-negative'), battery: values('battery'), sourceLength: host.data.find(series => series.id === 'grid-negative').data.length };
  });
  expect(state).toEqual({ grid: [0, .42, null, -.16, .28, .18], negative: [], battery: [.04, .06, .08, -.12, .05, .03], sourceLength: 6 });
  const table = await openTable(page, 'Power over time');
  await expect(table.locator('tbody tr')).toHaveCount(24);
  await expect(table.getByRole('row').filter({ hasText: 'Grid power' })).toHaveCount(6);
  const toggle = page.locator('hui-power-sources-graph-card .legend-toggle[data-id=grid]');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.filter(series => ['grid', 'grid-negative'].includes(series.id)).every(series => !series.data?.length))).toBe(true);
  await expect(table.getByRole('row').filter({ hasText: 'Grid power' })).toHaveCount(6);
  await toggle.click();
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.find(series => series.id === 'grid').data.map(point => (point.value ?? point)[1]))).toEqual([0, .42, null, -.16, .28, .18]);
  await page.evaluate(() => { const chart = window.energyFixture.hosts.power.chart; chart.dispatchAction({ type: 'showTip', seriesIndex: chart.getOption().series.findIndex(series => series.id === 'grid'), dataIndex: 3 }); });
  const tooltip = page.locator('hui-power-sources-graph-card .native-tooltip');
  await expect(tooltip.locator('[data-series-id="grid"]')).toHaveCount(1);
  await expect(tooltip.locator('[data-series-id="grid-negative"]')).toHaveCount(0);
  await expect(tooltip).toContainText('Grid power: -0.16 kW');
  expect(await page.evaluate(() => window.energyFixture.hosts.power.data === window.powerNativeReference && JSON.stringify(window.energyFixture.hosts.power.data) === window.powerNativeText)).toBe(true);
  await page.getByRole('button', { name: 'Show next sample day for time charts', exact: true }).click();
  await expect(table).toContainText('12 Nov 2026'); await expect(table).not.toContainText('11 Nov 2026');
  await page.evaluate(() => window.energyFixture.setActive(false));
  const restored = await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.filter(series => ['grid', 'grid-negative'].includes(series.id)).map(series => ({ id: series.id, values: series.data.map(point => (point.value ?? point)[1]) })));
  expect(restored).toEqual([{ id: 'grid', values: [0, .42, null, 0, .28, .18] }, { id: 'grid-negative', values: [0, 0, null, -.16, 0, 0] }]);
});

test('Power projection leaves ambiguous signs, missing pairs and unequal timestamps unchanged', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => { window.projectionBaseline = JSON.stringify(window.energyFixture.hosts.power.data); });
  for (const scenario of ['timestamps', 'non-complementary', 'missing-value', 'missing-pair', 'unknown-identity']) {
    await page.evaluate(scenario => {
      const f = window.energyFixture, data = JSON.parse(window.projectionBaseline);
      const primary = data.find(series => series.id === 'grid'), secondary = data.find(series => series.id === 'grid-negative');
      if (scenario === 'timestamps') secondary.data[3].value[0] += 1;
      if (scenario === 'non-complementary') primary.data[3].value[1] = .2;
      if (scenario === 'missing-value') secondary.data[2].value[1] = 0;
      if (scenario === 'missing-pair') data.splice(data.indexOf(secondary), 1);
      if (scenario === 'unknown-identity') { primary.id = 'unknown'; secondary.id = 'unknown-negative'; }
      f.replaceData('power', data);
      window.guardExpected = { primary: primary.data.map(point => point.value), secondary: scenario === 'missing-pair' ? undefined : secondary.data.map(point => point.value), primaryId: primary.id, secondaryId: secondary.id, sourceText: JSON.stringify(data), sourceReference: data };
    }, scenario);
    await expect.poll(() => page.evaluate(() => {
      const host = window.energyFixture.hosts.power, expected = window.guardExpected, rendered = host.chart.getOption().series;
      return { primary: rendered.find(series => series.id === expected.primaryId).data.map(point => point.value ?? point), secondary: rendered.find(series => series.id === expected.secondaryId)?.data.map(point => point.value ?? point) };
    })).toEqual(await page.evaluate(() => ({ primary: window.guardExpected.primary, secondary: window.guardExpected.secondary })));
    expect(await page.evaluate(() => window.energyFixture.hosts.power.data === window.guardExpected.sourceReference && JSON.stringify(window.energyFixture.hosts.power.data) === window.guardExpected.sourceText)).toBe(true);
  }
});

test('deactivation during a native date update never mixes new readings with old axes', async ({ page }) => {
  await openExamples(page);
  const before = await page.evaluate(() => {
    const f = window.energyFixture, host = f.hosts.power, option = host.chart.getOption();
    window.pendingPowerData = host.data.map(series => ({ ...series, data: series.data.map(point => { const values = point.value ?? point, next = [values[0] + 86400000, ...values.slice(1)]; return point.value ? { ...point, value: next } : next; }) }));
    window.pendingPowerText = JSON.stringify(window.pendingPowerData);
    const currentTimes = option.series.flatMap(series => series.data.map(point => (point.value ?? point)[0]));
    // HA property update is ahead of its scheduled chart.setOption render.
    host.data = window.pendingPowerData;
    f.setActive(false);
    return { currentTimes, bounds: [option.xAxis[0].min, option.xAxis[0].max] };
  });
  const pending = await page.evaluate(() => {
    const host = window.energyFixture.hosts.power, option = host.chart.getOption();
    return { currentTimes: option.series.flatMap(series => series.data.map(point => (point.value ?? point)[0])), bounds: [option.xAxis[0].min, option.xAxis[0].max], sourcePreserved: host.data === window.pendingPowerData && JSON.stringify(host.data) === window.pendingPowerText };
  });
  expect(pending).toEqual({ ...before, sourcePreserved: true });
  await page.evaluate(() => {
    const f = window.energyFixture, host = f.hosts.power;
    f.replaceData('power', host.data, { ...host.options, xAxis: { ...host.options.xAxis, min: Date.UTC(2026, 10, 12), max: Date.UTC(2026, 10, 12, 3) } });
  });
  const native = await page.evaluate(() => {
    const option = window.energyFixture.hosts.power.chart.getOption();
    return { first: option.series.find(series => series.id === 'grid').data[0].value[0], negativeCount: option.series.find(series => series.id === 'grid-negative').data.length, bounds: [option.xAxis[0].min, option.xAxis[0].max] };
  });
  expect(native).toEqual({ first: Date.UTC(2026, 10, 12), negativeCount: 6, bounds: [Date.UTC(2026, 10, 12), Date.UTC(2026, 10, 12, 3)] });
  await page.evaluate(() => window.energyFixture.setActive(true));
  const table = await openTable(page, 'Power over time');
  await expect(table.locator('tbody tr')).toHaveCount(24); await expect(table).toContainText('12 Nov 2026'); await expect(table).not.toContainText('11 Nov 2026');
});

test('cross hatching and isolated hollow symbols match their visible legend keys', async ({ page }) => {
  await openExamples(page);
  const cross = await page.evaluate(() => {
    const host = window.energyFixture.hosts.many, series = host.chart.getOption().series.find(series => series.id.startsWith('sensor.dishwasher_energy-'));
    const button = [...host.shadowRoot.querySelectorAll('.legend-toggle')].find(button => button.dataset.id === series.id);
    const data = host.chart.getModel().getSeries().find(model => model.id === series.id).getData();
    return { rendererSymbol: series.itemStyle.decal.symbol, keyPath: button.querySelector('.civica-chart-key pattern path').getAttribute('d'), paintedPattern: !!data.getItemVisual(0, 'style').decal?.image };
  });
  expect(cross.rendererSymbol).toBe(`path://${cross.keyPath}`); expect(cross.paintedPattern).toBe(true);
  await page.evaluate(() => window.energyFixture.replaceData('power', [
    { id: 'sensor.dishwasher_energy', name: 'Dishwasher', type: 'line', data: [[Date.UTC(2026, 10, 11, 1), .2]] },
    { id: 'sensor.home_office_energy', name: 'Home office', type: 'line', data: [[Date.UTC(2026, 10, 11, 1), .3]] },
  ]));
  await expect.poll(() => page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.every(series => series.showSymbol))).toBe(true);
  const symbols = await page.evaluate(() => {
    const host = window.energyFixture.hosts.power;
    return host.chart.getModel().getSeries().map(series => {
      let shape; series.getData().getItemGraphicEl(0).traverse(child => { if (child.shape) shape = child; });
      const button = [...host.shadowRoot.querySelectorAll('.legend-toggle')].find(button => button.dataset.id === series.id);
      const keyShape = button.querySelector('.civica-chart-key > :last-child');
      return { id: series.id, symbol: series.option.symbol, rendererShape: shape.shape.symbolType, fill: shape.style.fill, stroke: shape.style.stroke, keyTag: keyShape.localName, keyFill: keyShape.getAttribute('fill'), keyStroke: keyShape.getAttribute('stroke') };
    });
  });
  expect(symbols.map(symbol => symbol.symbol)).toEqual(['emptyCircle', 'emptyTriangle']);
  for (const symbol of symbols) {
    expect(symbol.rendererShape).toBe(symbol.symbol.slice(5).toLowerCase());
    expect(symbol.keyTag).toBe(symbol.symbol === 'emptyCircle' ? 'circle' : 'path');
    expect(symbol.fill.toUpperCase()).toMatch(/^#FFF(?:FFF)?$/); expect(symbol.keyFill).toBe('#FFFFFF'); expect(symbol.keyStroke).toBe(symbol.stroke);
  }
});

test('closed Power data table waits for the native plot during reference and in-place source updates', async ({ page }) => {
  for (const mutation of ['replacement', 'in-place']) {
    await openExamples(page);
    await page.evaluate(mutation => {
      const f = window.energyFixture, host = f.hosts.power;
      if (mutation === 'replacement') host.data = JSON.parse(JSON.stringify(host.data));
      for (const series of host.data) for (const point of series.data) (point.value ?? point)[0] += 86400000;
      f.refresh(); // Reconcile before HA's scheduled native chart render.
    }, mutation);
    const table = await openTable(page, 'Power over time');
    await expect(table.locator('tbody tr')).toHaveCount(24);
    await expect(table).toContainText('11 Nov 2026'); await expect(table).not.toContainText('12 Nov 2026');
    expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.find(series => series.id === 'grid').data[0].value[0])).toBe(Date.UTC(2026, 10, 11));
    await page.evaluate(() => {
      const f = window.energyFixture, host = f.hosts.power;
      f.replaceData('power', host.data, { ...host.options, xAxis: { ...host.options.xAxis, min: Date.UTC(2026, 10, 12), max: Date.UTC(2026, 10, 12, 3) } });
    });
    await expect(table).toContainText('12 Nov 2026'); await expect(table).not.toContainText('11 Nov 2026');
    await expect(table.locator('tbody tr')).toHaveCount(24);
  }
});

test('the shared lighter stroke stays consistent for dense narrow Power and native solar forecast lines', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openExamples(page);
  const note = page.locator('.chart-spec');
  await expect(note).toHaveText('Line charts and their legend keys use 1.5px strokes, including on hover.');
  expect(await page.evaluate(() => window.energyFixture.presentationSpec.lineWidth)).toBe(1.5);
  await page.evaluate(() => {
    const f = window.energyFixture, t = Date.UTC(2026, 10, 11);
    // Exercise a dense source at the width of a native mobile Energy card.
    const signed = (id, index) => id.startsWith('grid') ? .3 * Math.sin(index / 13) : id.startsWith('battery') ? .08 * Math.cos(index / 17) : id === 'solar' ? .2 + .1 * Math.sin(index / 23) : .45;
    f.replaceData('power', f.hosts.power.data.map(series => ({ ...series, data: Array.from({ length: 181 }, (_, index) => ({ value: [t + index * 60000, series.id.endsWith('-negative') ? Math.min(0, signed(series.id, index)) : Math.max(0, signed(series.id, index))] })) })));
    // Reuse the empty fixture's real renderer under another supported native
    // card. Shape follows energy-solar-graph-data.ts's forecast output.
    const previous = f.cards.empty, solar = document.createElement('hui-energy-solar-graph-card');
    solar.attachShadow({ mode: 'open' }).append(...previous.shadowRoot.childNodes);
    solar.shadowRoot.querySelector('.card-header').textContent = 'Example solar forecast';
    solar.shadowRoot.querySelector('.empty')?.remove(); previous.replaceWith(solar); f.cards.empty = solar;
    const forecast = { id: 'forecast-sensor.example_solar', type: 'line', stack: 'forecast', name: 'Solar forecast', step: false, color: '#0B0C0C', lineStyle: { type: [7, 5], width: 1.5 }, symbol: 'none', data: [[t + 1800000, .2], [t + 5400000, .4], [t + 9000000, .3]] };
    f.replaceData('empty', [forecast]);
    window.denseNativeReadings = JSON.stringify(f.hosts.power.data.map(series => series.data.map(point => point.value)));
    window.forecastNativeReadings = JSON.stringify(forecast.data);
  });
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => window.energyFixture.setMode(mode), mode);
    await page.evaluate(() => {
      const f = window.energyFixture;
      f.hosts.power.chart.dispatchAction({ type: 'highlight', seriesId: 'grid' });
      f.hosts.empty.chart.dispatchAction({ type: 'highlight', seriesIndex: 0 });
    });
    await expect.poll(() => page.evaluate(() => ['power', 'empty'].map(key => {
      const host = window.energyFixture.hosts[key];
      return {
        widths: host.chart.getZr().storage.getDisplayList().filter(shape => shape.type === 'ec-polyline' && shape.shape.points.length).map(shape => shape.style.lineWidth),
        keys: [...new Set([...host.shadowRoot.querySelectorAll('.civica-chart-key line')].map(line => Number(line.getAttribute('stroke-width'))))],
      };
    }))).toEqual([{ widths: [1.5, 1.5, 1.5, 1.5], keys: [1.5] }, { widths: [1.5], keys: [1.5] }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await page.evaluate(() => JSON.stringify(window.energyFixture.hosts.power.data.map(series => series.data.map(point => point.value))) === window.denseNativeReadings)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.energyFixture.hosts.empty.data[0].data) === window.forecastNativeReadings)).toBe(true);
  await page.evaluate(() => window.energyFixture.setActive(false));
  await expect(note).toBeHidden();
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getOption().series.find(series => series.id === 'grid').lineStyle.width)).toBe(1);
  expect(await page.evaluate(() => window.energyFixture.hosts.empty.chart.getOption().series[0].lineStyle.width)).toBe(1.5);
});

test('native legend and theme redraws cannot leave animated sign-pair geometry behind', async ({ page }) => {
  await openExamples(page);
  await page.evaluate(() => {
    const f = window.energyFixture; f.setActive(false);
    window.nativeLineAnimations = f.hosts.power.chart.getModel().getSeries().map(series => [series.get('animation'), series.get('animationDuration'), series.get('animationDurationUpdate')]);
    f.setActive(true);
  });
  const geometry = () => page.evaluate(() => {
    const chart = window.energyFixture.hosts.power.chart;
    let drawn = 0, coordinatesMatch = true, emptySeriesClear = true;
    for (const series of chart.getModel().getSeries()) {
      const paths = [];
      chart.getViewOfSeriesModel(series).group.traverse(shape => { if (shape.type === 'ec-polyline' && shape.shape.points.length) paths.push(shape); });
      drawn += paths.length;
      const data = series.option.data ?? [];
      if (!data.length) { emptySeriesClear &&= paths.length === 0; continue; }
      coordinatesMatch &&= paths.length === 1;
      const actual = paths[0]?.shape.points ?? [];
      coordinatesMatch &&= actual.length === data.length * 2;
      data.forEach((point, index) => {
        const values = point.value ?? point;
        if (values[1] === null) { coordinatesMatch &&= !Number.isFinite(actual[index * 2 + 1]); return; }
        const expected = chart.convertToPixel({ seriesIndex: series.seriesIndex }, values);
        coordinatesMatch &&= Math.abs(actual[index * 2] - expected[0]) < .01 && Math.abs(actual[index * 2 + 1] - expected[1]) < .01;
      });
    }
    return { drawn, coordinatesMatch, emptySeriesClear };
  });
  await expect.poll(geometry).toEqual({ drawn: 4, coordinatesMatch: true, emptySeriesClear: true });
  const solar = page.locator('hui-power-sources-graph-card .label[data-id=solar]');
  for (const action of ['hide solar', 'show solar', 'dark', 'light', 'next day']) {
    if (action === 'hide solar' || action === 'show solar') await solar.click();
    else if (action === 'next day') await page.getByRole('button', { name: 'Show next sample day for time charts', exact: true }).click();
    else await page.evaluate(mode => window.energyFixture.setMode(mode), action);
    const expected = { drawn: action === 'hide solar' ? 3 : 4, coordinatesMatch: true, emptySeriesClear: true };
    await expect.poll(geometry).toEqual(expected);
    // The former bug returned later: a native500ms animator overwrote the
    // already-correct option model and left permanent stale Canvas paths.
    await page.waitForTimeout(650);
    expect(await geometry()).toEqual(expected);
  }
  await page.evaluate(() => window.energyFixture.setActive(false));
  expect(await page.evaluate(() => window.energyFixture.hosts.power.chart.getModel().getSeries().map(series => [series.get('animation'), series.get('animationDuration'), series.get('animationDurationUpdate')]))).toEqual(await page.evaluate(() => window.nativeLineAnimations));
});
