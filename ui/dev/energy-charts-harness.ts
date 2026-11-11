// Standalone examples use the production adapter with real ECharts. They do
// not load Home Assistant, connect to an account or call a device service.
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import source from '../../design-system/themes.json' with { type: 'json' };
import palettes from '../../design-system/palettes.json' with { type: 'json' };
import { updateEnergyCharts } from '../src/energy-charts';
import type { EnergyChartDataHost } from '../src/energy-chart-data';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);
type DemoHost = EnergyChartDataHost & { chart: echarts.EChartsType; data: any[]; options: any };
type Key = 'power' | 'usage' | 'devices' | 'empty';
const T = Date.UTC(2026, 10, 11), HOUR = 3600000;
const deviceNames: Record<string, string> = { 'sensor.example_washer': 'Washing machine', 'sensor.example_fridge': 'Fridge and freezer', 'sensor.example_vacuum': 'Robot vacuum' };
const setup = new WeakMap<HTMLElement, ReturnType<typeof build>>();

const STYLE = `
:host{display:block;min-width:0;color:var(--primary-text-color);background:var(--primary-background-color);font:var(--civica-font-size-body,19px)/1.5 var(--ha-font-family-body,Arial,sans-serif)}*{box-sizing:border-box}.intro{padding:20px;margin:0}.controls{display:flex;flex-wrap:wrap;gap:15px 20px;padding:0 20px 20px;align-items:end}.controls label{display:flex;gap:10px;align-items:center;min-height:44px;font-size:var(--civica-font-size-small,16px)}.controls .palette{display:grid;gap:5px}.controls input{width:24px;height:24px;accent-color:var(--primary-color)}select,button{min-height:44px;font:inherit;font-size:var(--civica-font-size-small,16px);background:var(--card-background-color);color:var(--primary-text-color);border:2px solid var(--primary-text-color);border-radius:0;padding:7px 10px;max-width:100%}.controls :is(select,input,button):focus-visible{outline:3px solid var(--ha-color-focus);outline-offset:0}.controls button:focus-visible{background:var(--ha-color-focus);color:var(--civica-focus-text);box-shadow:0 2px 0 var(--civica-focus-text)}.error{padding:20px;border-left:5px solid var(--error-color)}
`;
const CARD_STYLE = `
:host{display:block;min-width:0}ha-card{display:block;min-width:0;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);padding:20px}h2{font-size:var(--civica-font-size-heading,24px);line-height:1.25;margin:0 0 10px}p{font-size:var(--civica-font-size-small,16px);line-height:1.5;margin:0 0 15px}.content{min-width:0}
`;
const CHART_STYLE = `
:host{display:block;min-width:0}.container{display:flex;flex-direction:column}.chart-container{width:100%;height:240px}.chart{width:100%;height:100%}.chart-legend ul{list-style:none;margin:10px 0;padding:0;display:flex;flex-wrap:wrap;gap:10px}.chart-legend li{display:flex}.chart-legend button{display:flex;align-items:center;gap:8px;min-height:44px;padding:8px;border:1px solid transparent;background:transparent;color:var(--primary-text-color);font:14px/1.5 Arial,sans-serif;cursor:pointer}.chart-legend button:focus-visible{outline:3px solid var(--ha-color-focus);outline-offset:0}.key{width:12px;height:12px;background:var(--key);border:1px solid var(--key);border-radius:50%}.chart-legend button[aria-pressed=false]{text-decoration:line-through}.empty{font-size:16px;margin:10px 0;color:var(--secondary-text-color)}
`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;
}
function nativeOptions(key: Key): any {
  const tooltipFormatter = (params: any) => `${Array.isArray(params) ? params.length : 1} example value(s)`;
  return {
    animation: false, textStyle: { fontFamily: 'Roboto, sans-serif', fontSize: 12 },
    grid: { left: 16, right: 16, top: 32, bottom: 32, containLabel: true },
    tooltip: { trigger: 'axis', formatter: tooltipFormatter },
    xAxis: key === 'devices' ? { type: 'value', name: 'kWh', min: 0 } : { type: 'time', min: T, max: T + 3 * HOUR },
    yAxis: key === 'devices' ? { type: 'category', inverse: true, data: Object.keys(deviceNames), axisLabel: { formatter: (key: string) => deviceNames[key], width: 100, overflow: 'break', fontSize: 12 } } : { type: 'value', name: key === 'power' ? 'W' : 'kWh' },
    legend: { type: 'custom', show: true, data: [] },
  };
}

function build(target: HTMLElement) {
  const root = target.shadowRoot ?? target.attachShadow({ mode: 'open' });
  const style = element('style', STYLE), intro = element('p', 'These examples use invented data. They do not show or control your home.'); intro.className = 'intro';
  const controls = element('div'); controls.className = 'controls';
  const paletteLabel = element('label', 'Example palette'); paletteLabel.className = 'palette';
  const palette = element('select'); palette.setAttribute('aria-label', 'Example palette');
  for (const p of palettes.palettes) { const option = element('option', p.name); option.value = p.id; palette.append(option); }
  paletteLabel.append(palette);
  const checkbox = (text: string, checked = false) => { const label = element('label'), input = element('input'); input.type = 'checkbox'; input.checked = checked; label.append(input, text); return { label, input }; };
  const dark = checkbox('Dark example'), muted = checkbox('Muted colours'), enabled = checkbox('Apply civica chart styles', true);
  const nextDay = element('button', 'Show next sample day'); nextDay.type = 'button';
  controls.append(paletteLabel, muted.label, dark.label, enabled.label, nextDay);
  const panel = document.createElement('ha-panel-energy'); const panelRoot = panel.attachShadow({ mode: 'open' });
  const panelStyle = element('style', ':host{display:block;min-width:0}.examples{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;padding:0 20px 20px}');
  const examples = element('div'); examples.className = 'examples'; panelRoot.append(panelStyle, examples);
  root.replaceChildren(style, intro, controls, panel);
  const hosts = {} as Record<Key, DemoHost>;
  const cards = {} as Record<Key, HTMLElement>;
  const plots = {} as Record<Key, HTMLElement>;
  const nativeClicks: string[] = [];
  const descriptions: Record<Key, string> = {
    power: 'Example power over three hours on 11 November 2026. Watts (W) measure power at a point in time. A gap means a value was not available.',
    usage: 'Example hourly energy on 11 November 2026, compared with 10 November. Kilowatt hours (kWh) measure energy used over a period. Lighter columns show the comparison period.',
    devices: 'Example energy by device for 11 November 2026. Values are in kilowatt hours (kWh). A zero is different from an unavailable reading.',
    empty: 'Example gas chart with no values for the selected period. No readings have been invented to fill it.',
  };
  const specs: Array<[Key, string, string]> = [
    ['power', 'hui-power-sources-graph-card', 'Power over time'],
    ['usage', 'hui-energy-usage-graph-card', 'Hourly energy use'],
    ['devices', 'hui-energy-devices-graph-card', 'Energy used by devices'],
    ['empty', 'hui-energy-gas-graph-card', 'Gas use — no data'],
  ];
  function colours() { const css = getComputedStyle(target); return (token: string) => css.getPropertyValue(token).trim(); }
  function dataset(key: Key): any[] {
    const colour = colours();
    if (key === 'power') return [
      { type: 'line', id: 'grid-power', name: 'Grid power', color: colour('--energy-grid-consumption-color'), symbol: 'circle', symbolSize: 5, connectNulls: false, lineStyle: { width: 1.5 }, data: [[T, 0], [T + HOUR / 2, 420], [T + HOUR, null], [T + HOUR * 1.5, -160], [T + HOUR * 2, 280], [T + HOUR * 3, 180]] },
      { type: 'line', id: 'solar-power', name: 'Solar power', color: colour('--energy-solar-color'), symbol: 'circle', symbolSize: 5, lineStyle: { width: 1.5 }, data: [[T, 0], [T + HOUR / 2, 160], [T + HOUR, 250], [T + HOUR * 1.5, 390], [T + HOUR * 2, 220], [T + HOUR * 3, 90]] },
    ];
    if (key === 'usage') return [
      { type: 'bar', id: 'grid-from_grid', name: 'Grid energy', stack: 'current', color: colour('--energy-grid-consumption-color'), data: [1.4, 0, 0.8].map((value, i) => [T + (i + .5) * HOUR, value, T + i * HOUR]) },
      { type: 'bar', id: 'used_solar-used_solar', name: 'Solar energy', stack: 'current', color: colour('--energy-solar-color'), data: [0.2, .6, .9].map((value, i) => [T + (i + .5) * HOUR, value, T + i * HOUR]) },
      { type: 'bar', id: 'compare-grid-from_grid', name: 'Grid energy', stack: 'comparison', color: colour('--energy-grid-consumption-color'), itemStyle: { opacity: .6 }, data: [1.0, 1.2, .7].map((value, i) => [T + (i + .5) * HOUR, value, T - 24 * HOUR + i * HOUR]) },
    ];
    if (key === 'devices') return [{ type: 'bar', id: 'devices', name: 'Energy used', itemStyle: { borderRadius: [0, 4, 4, 0] }, data: Object.keys(deviceNames).map((id, i) => ({ id, name: id, value: [[1.25, .65, 0][i], id], itemStyle: { color: colour(`--civica-chart-${i + 1}`), ...(i === 0 ? { borderRadius: [0, 6, 6, 0] } : {}) } })) }];
    return [];
  }
  const context: { locale: { language: string; number_format?: string; time_format?: string; time_zone?: string }; config: { time_zone: string } } = { locale: { language: 'en-GB' }, config: { time_zone: 'Europe/London' } };
  let day = 0;
  function paintTheme() {
    const p = palettes.palettes.find(item => item.id === palette.value)!;
    const name = `civica ${p.name} ${muted.input.checked ? 'Muted' : 'Vivid'}`;
    const theme = (source.themes as Record<string, any>)[name];
    for (const [key, value] of Object.entries({ ...theme, ...theme.modes[dark.input.checked ? 'dark' : 'light'] })) {
      if (typeof value === 'string' && !key.startsWith('card-mod')) target.style.setProperty(`--${key}`, value);
    }
  }
  paintTheme();
  function refresh() { updateEnergyCharts([panel], enabled.input.checked, context); }
  function renderNative(key: Key) {
    const host = hosts[key];
    const legend = host.shadowRoot!.querySelector('.chart-legend ul')!; legend.replaceChildren();
    const names = host.data.map(series => series.name);
    host.chart.setOption({ ...host.options, legend: { show: false, data: names }, series: host.data }, { notMerge: true });
    // HA groups a comparison series under its current-period legend item.
    // ECharts' same-name toggle also controls both in this standalone example.
    for (const series of host.data.filter(item => !String(item.id).startsWith('compare-'))) {
      const item = element('li'), button = element('button'); button.className = 'label'; button.type = 'button'; button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-label', `Show ${series.name}`);
      const keyNode = element('span'); keyNode.className = 'key'; keyNode.setAttribute('aria-hidden', 'true'); keyNode.style.setProperty('--key', series.color || colours()('--civica-chart-1'));
      button.append(keyNode, series.name); item.append(button); legend.append(item);
      button.onclick = () => { nativeClicks.push(series.name); const on = button.getAttribute('aria-pressed') === 'true'; button.setAttribute('aria-pressed', String(!on)); host.chart.dispatchAction({ type: 'legendToggleSelect', name: series.name }); };
    }
  }
  for (const [key, tag, title] of specs) {
    const card = document.createElement(tag), cardRoot = card.attachShadow({ mode: 'open' }); cards[key] = card;
    const shell = document.createElement('ha-card'); const heading = element('h2', title); heading.className = 'card-header';
    const description = element('p', descriptions[key]); description.className = 'chart-description';
    const content = element('div'); content.className = 'content';
    const host = document.createElement('ha-chart-base') as DemoHost; host.attachShadow({ mode: 'open' });
    const plot = element('div'); plot.className = 'chart'; plot.setAttribute('role', 'img'); plot.setAttribute('aria-label', `${title}. Use View data for all example values.`); plots[key] = plot;
    const legend = element('div'); legend.className = 'chart-legend'; legend.append(element('ul'));
    const container = element('div'); container.className = 'container'; const plotContainer = element('div'); plotContainer.className = 'chart-container'; plotContainer.append(plot); container.append(plotContainer, legend);
    host.shadowRoot!.append(element('style', CHART_STYLE), container); content.append(host); shell.append(heading, description, content); cardRoot.append(element('style', CARD_STYLE), shell); examples.append(card);
    host.options = nativeOptions(key); host.data = dataset(key);
    host.sonificationLabelFormatter = id => deviceNames[id];
    host.chart = echarts.init(plot, undefined, { renderer: 'svg' }); hosts[key] = host;
    renderNative(key);
    if (key === 'empty') { const empty = element('p', 'No example values for this period.'); empty.className = 'empty'; host.shadowRoot!.append(empty); }
  }
  const resize = new ResizeObserver(() => Object.values(hosts).forEach(host => host.chart.resize())); resize.observe(target);
  function changeTheme() {
    paintTheme();
    // Native HA refreshes its semantic series colours when display mode
    // changes. The example does likewise without replacing dates or values.
    for (const key of Object.keys(hosts) as Key[]) {
      const templates = dataset(key);
      hosts[key].data = hosts[key].data.map(series => {
        const template = templates.find(item => item.id === series.id);
        if (!template) return series;
        return { ...series, ...(template.color ? { color: template.color } : {}), data: series.data.map((point: any) => {
          if (!point || Array.isArray(point) || typeof point !== 'object') return point;
          const match = template.data.find((item: any) => item.id === point.id);
          return match?.itemStyle?.color ? { ...point, itemStyle: { ...point.itemStyle, color: match.itemStyle.color } } : point;
        }) };
      });
      renderNative(key);
    }
    refresh();
  }
  palette.onchange = muted.input.onchange = dark.input.onchange = changeTheme;
  enabled.input.onchange = refresh;
  nextDay.onclick = () => {
    day++;
    for (const key of ['power', 'usage'] as Key[]) {
      const host = hosts[key]; host.data = dataset(key).map(series => ({ ...series, data: series.data.map((point: any[]) => point.map((value, i) => i === 0 || i === 2 ? value + day * 24 * HOUR : value)) }));
      host.options = { ...host.options, xAxis: { ...host.options.xAxis, min: T + day * 24 * HOUR, max: T + day * 24 * HOUR + 3 * HOUR } };
      cards[key].shadowRoot!.querySelector('.chart-description')!.textContent = `Invented example values for ${11 + day} November 2026. See the table for the original period start and units.`;
      renderNative(key);
    }
    refresh();
  };
  refresh();
  return {
    panel, hosts, cards, nativeClicks, refresh,
    setActive(active: boolean) { enabled.input.checked = active; refresh(); },
    setMode(mode: 'light' | 'dark') { dark.input.checked = mode === 'dark'; changeTheme(); },
    setPalette(id: string) { palette.value = id; changeTheme(); },
    setPreferences(preferences: Partial<typeof context.locale>) { Object.assign(context.locale, preferences); refresh(); },
    replaceData(key: Key, data: any[], options?: any) { hosts[key].data = data; if (options) hosts[key].options = options; renderNative(key); refresh(); },
    recreateChart(key: Key) { if (!hosts[key].chart.isDisposed()) hosts[key].chart.dispose(); hosts[key].chart = echarts.init(plots[key], undefined, { renderer: 'svg' }); renderNative(key); refresh(); },
    dispose() { updateEnergyCharts([], false); resize.disconnect(); Object.values(hosts).forEach(host => host.chart.dispose()); root.replaceChildren(); setup.delete(target); },
  };
}

export function initialiseEnergyExamples(target: HTMLElement) {
  let fixture = setup.get(target);
  if (!fixture) { fixture = build(target); setup.set(target, fixture); }
  return fixture;
}
declare global { interface Window { energyFixture?: ReturnType<typeof build> } }
for (const target of document.querySelectorAll<HTMLElement>('[data-civica-energy-examples]')) window.energyFixture ??= initialiseEnergyExamples(target);
