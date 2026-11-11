// Synthetic readings in the public data/option shapes used by HA Frontend
// 20261028.5. These examples use the production adapter and Canvas ECharts;
// they do not load HA, connect to an account or control a device.
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import source from '../../design-system/themes.json' with { type: 'json' };
import palettes from '../../design-system/palettes.json' with { type: 'json' };
import { CHART_COLOUR_SPEC, chartColour, chartSeriesStyle } from '../../design-system/chart-colours.mjs';
import { ENERGY_CHART_SPEC, updateEnergyCharts } from '../src/energy-charts';
import type { EnergyChartDataHost } from '../src/energy-chart-data';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, LabelLayout, UniversalTransition, CanvasRenderer]);
type DemoHost = EnergyChartDataHost & { chart: echarts.EChartsType; data: any[]; options: any; height?: string };
type Key = 'power' | 'usage' | 'devices' | 'many' | 'empty';
const T = Date.UTC(2026, 10, 11), HOUR = 3600000;
const deviceNames: Record<string, string> = Object.fromEntries(CHART_COLOUR_SPEC.exampleKeys.filter(({ label }: { label: string }) => ['Washing machine', 'Fridge and freezer', 'Robot vacuum'].includes(label)).map(({ key, label }: { key: string; label: string }) => [key, label]));
// Stable statistic IDs, rather than series order, are the colour identities.
const manyDevices = CHART_COLOUR_SPEC.exampleKeys.map(({ key, label }: { key: string; label: string }) => ({ key, name: label }));
const setup = new WeakMap<HTMLElement, ReturnType<typeof build>>();
const STYLE = `
:host{display:block;min-width:0;color:var(--primary-text-color);background:var(--primary-background-color);font:var(--civica-font-size-body,19px)/1.5 var(--ha-font-family-body,Arial,sans-serif)}*{box-sizing:border-box}.intro{padding:20px;margin:0}.chart-spec{padding:0 20px 20px;margin:0;font-size:var(--civica-font-size-small,16px)}.controls{display:flex;flex-wrap:wrap;gap:15px 20px;padding:0 20px 20px;align-items:end}.controls label{display:flex;gap:10px;align-items:center;min-height:44px;font-size:var(--civica-font-size-small,16px)}.controls .palette{display:grid;gap:5px}.controls input{width:24px;height:24px;accent-color:var(--primary-color)}select,button{min-height:44px;font:inherit;font-size:var(--civica-font-size-small,16px);background:var(--card-background-color);color:var(--primary-text-color);border:2px solid var(--primary-text-color);border-radius:0;padding:7px 10px;max-width:100%}.controls :is(select,input,button):focus-visible{outline:3px solid var(--ha-color-focus);outline-offset:0}.controls button:focus-visible{background:var(--ha-color-focus);color:var(--civica-focus-text);box-shadow:0 2px 0 var(--civica-focus-text)}
`;
const CARD_STYLE = `
:host{display:block;min-width:0}ha-card{display:block;min-width:0;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);padding:20px}h2{font-size:var(--civica-font-size-heading,24px);line-height:1.25;margin:0 0 10px}p{font-size:var(--civica-font-size-small,16px);line-height:1.5;margin:0 0 15px}.content{min-width:0}
`;
// Keep the same legend structure and native inline colour precedence as HA.
// The adapter, not this fixture, supplies the ONS presentation overrides.
const CHART_STYLE = `
:host{display:block;min-width:0}.container{display:flex;flex-direction:column}.chart-container{width:100%;height:240px}.chart{width:100%;height:100%}.chart-legend ul{list-style:none;margin:10px 0;padding:0;display:flex;flex-wrap:wrap;gap:0 8px;justify-content:center}.chart-legend li{display:flex;align-items:center;min-width:0}.chart-legend button{border:0;background:transparent;color:inherit;font:14px/1.5 Roboto,Arial,sans-serif;cursor:pointer}.chart-legend .legend-toggle{padding:4px;width:32px;height:32px;flex:none}.chart-legend .label{padding:4px;min-width:0;text-align:left;overflow-wrap:anywhere}.chart-legend .value{padding:0 4px;font:12px/1.5 Roboto,Arial,sans-serif;white-space:nowrap}.chart-legend .hidden{color:var(--secondary-text-color)}.chart-legend .hidden .label{text-decoration:line-through}.chart-legend button:focus-visible{outline:3px solid var(--ha-color-focus);outline-offset:0}ha-svg-icon{display:inline-flex;align-items:center;justify-content:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}ha-svg-icon svg{width:100%;height:100%;fill:currentColor}.empty{font-size:16px;margin:10px 0;color:var(--secondary-text-color)}ha-chart-tooltip-marker{display:inline-block;width:10px;height:10px;border-radius:10px;margin-inline-end:4px;vertical-align:middle}.native-tooltip{font:14px/1.5 Arial,sans-serif}.native-tooltip h4{margin:0;text-align:center}
`;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;
}
function rgba(hex: string, opacity: number) {
  const rgb = hex.replace('#', '').slice(0, 6).match(/../g)!.map(value => parseInt(value, 16));
  return `rgba(${rgb.join(',')},${opacity})`;
}
function nativeTooltip(params: any, key: Key): HTMLElement {
  const entries = Array.isArray(params) ? params : [params];
  const output = element('div'); output.className = 'native-tooltip';
  const first = entries[0];
  if (first) output.append(element('h4', key === 'devices' ? deviceNames[first.value?.[1]] ?? String(first.value?.[1]) : new Date(first.value?.[2] ?? first.value?.[0] ?? T).toLocaleString('en-GB', { timeZone: 'Europe/London' })));
  for (const param of entries) {
    const values = param.value ?? param.data?.value, value = values?.[typeof values?.[1] === 'string' ? 0 : 1];
    if (value === null || value === undefined || value === 0) continue;
    const row = element('div'); row.dataset.seriesId = param.seriesId;
    const marker = document.createElement('ha-chart-tooltip-marker');
    // HA's Lit formatter sets the marker's public .color from param.color;
    // ha-chart-tooltip-marker then writes that colour to its own background.
    (marker as any).color = String(param.color ?? ''); marker.style.backgroundColor = (marker as any).color;
    row.append(marker, `${param.seriesName}: ${value} ${key === 'power' ? 'kW' : 'kWh'}`); output.append(row);
  }
  return output;
}
function nativeOptions(key: Key): any {
  return {
    grid: { left: 1, right: 1, top: 15, bottom: 0, containLabel: true },
    tooltip: { trigger: 'axis', confine: true, formatter: (params: any) => nativeTooltip(params, key) },
    xAxis: key === 'devices' ? { type: 'value', name: 'kWh', min: 0 } : { type: 'time', min: T, max: T + 3 * HOUR },
    yAxis: key === 'devices' ? { type: 'category', inverse: true, data: Object.keys(deviceNames), axisLabel: { formatter: (key: string) => deviceNames[key], width: 100, overflow: 'break' } } : { type: 'value', name: key === 'power' ? 'kW' : 'kWh', nameGap: 2, nameTextStyle: { align: 'left' }, splitLine: { show: true } },
    legend: { type: 'custom', show: true, data: [] },
  };
}

function build(target: HTMLElement) {
  const root = target.shadowRoot ?? target.attachShadow({ mode: 'open' });
  const style = element('style', STYLE), intro = element('p', 'All readings and device names below are invented examples. They do not show or control your home.'); intro.className = 'intro';
  const controls = element('div'); controls.className = 'controls';
  const lineWeight = element('p', `Line charts and their legend keys use ${ENERGY_CHART_SPEC.lineWidth}px strokes, including on hover.`); lineWeight.className = 'chart-spec';
  const paletteLabel = element('label', 'Example brand palette'); paletteLabel.className = 'palette';
  const palette = element('select'); palette.setAttribute('aria-label', 'Example brand palette');
  for (const p of palettes.palettes) { const option = element('option', p.name); option.value = p.id; palette.append(option); }
  paletteLabel.append(palette);
  const checkbox = (text: string, checked = false) => { const label = element('label'), input = element('input'); input.type = 'checkbox'; input.checked = checked; label.append(input, text); return { label, input }; };
  const dark = checkbox('Dark example'), muted = checkbox('Muted chart colours'), enabled = checkbox('Apply civica chart styles', !new URLSearchParams(location.search).has('native'));
  const nextDay = element('button', 'Show next sample day'); nextDay.type = 'button';
  nextDay.hidden = ['devices', 'empty'].includes(target.dataset.exampleChart ?? '');
  if (!target.dataset.exampleChart) nextDay.textContent = 'Show next sample day for time charts';
  controls.append(paletteLabel, muted.label, dark.label, enabled.label, nextDay);
  const panel = document.createElement('ha-panel-energy'); const panelRoot = panel.attachShadow({ mode: 'open' });
  const panelStyle = element('style', ':host{display:block;min-width:0}.examples{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;padding:0 20px 20px}');
  const examples = element('div'); examples.className = 'examples'; panelRoot.append(panelStyle, examples);
  root.replaceChildren(style, intro, controls, lineWeight, panel);
  const hosts = {} as Record<Key, DemoHost>, cards = {} as Record<Key, HTMLElement>, plots = {} as Record<Key, HTMLElement>;
  const hidden = Object.fromEntries(['power', 'usage', 'devices', 'many', 'empty'].map(key => [key, new Set<string>()])) as Record<Key, Set<string>>;
  const nativeClicks: string[] = [];
  const descriptions: Record<Key, string> = {
    power: 'Example power from midnight to 3am on 11 November 2026 (GMT, Europe/London). Individual unfilled lines show kilowatts (kW), including exported power below zero. A gap means a value was unavailable.',
    usage: 'Example hourly energy from midnight to 3am on 11 November 2026 (GMT, Europe/London), compared with 10 November. Solid and patterned columns distinguish the periods. Stacked values remain separate in the data table.',
    devices: 'Fixed example energy by device for 11 November 2026 and 10 November 2026 (GMT, Europe/London). Values are in kilowatt hours (kWh). A zero is different from an unavailable reading.',
    many: '24 named example devices from midnight to 3am on 11 November 2026, compared with 10 November (GMT, Europe/London), each with a stable colour and pattern. These use Home Assistant’s individual device detail chart shapes.',
    empty: 'Fixed example gas chart with no values for 11 November 2026 (GMT, Europe/London). No readings have been invented to fill it.',
  };
  const specs: Array<[Key, string, string]> = [
    ['power', 'hui-power-sources-graph-card', 'Power over time'],
    ['usage', 'hui-energy-usage-graph-card', 'Hourly energy use'],
    ['devices', 'hui-energy-devices-graph-card', 'Energy used by devices'],
    ['many', 'hui-energy-devices-detail-graph-card', '24 devices over time'],
    ['empty', 'hui-energy-gas-graph-card', 'Gas use — no data'],
  ];
  function colours() { const css = getComputedStyle(target); return (token: string) => css.getPropertyValue(token).trim(); }
  function graphColour(index: number) { return colours()(`--color-${index % 8 + 1}`) || ['#4263EB', '#F76707', '#099268', '#AE3EC9', '#D6336C', '#1098AD', '#E67700', '#5C7CFA'][index % 8]; }
  function dataset(key: Key): any[] {
    const colour = colours();
    // Shape: power-sources-graph-data.ts. Values are independent raw readings
    // (not cumulative totals), split by sign. fillLineGaps wraps them in .value.
    if (key === 'power') {
      const definitions: Array<[string, string, string, (number | null)[]]> = [
        ['solar', 'Solar power', '--energy-solar-color', [0, .16, .25, .39, .22, .09]],
        ['battery', 'Battery power', '--energy-battery-out-color', [.04, .06, .08, 0, .05, .03]],
        ['grid', 'Grid power', '--energy-grid-consumption-color', [0, .42, null, 0, .28, .18]],
        ['battery-negative', 'Battery power', '--energy-battery-out-color', [0, 0, 0, -.12, 0, 0]],
        ['grid-negative', 'Grid power', '--energy-grid-consumption-color', [0, 0, null, -.16, 0, 0]],
      ];
      const times = [0, .5, 1, 1.5, 2, 3];
      const values = definitions.map(([id, name, token, data], i) => {
        const base = colour(token), negative = id.endsWith('-negative');
        return { type: 'line', smooth: .4, lineStyle: { width: 1 }, id, name, color: base, stack: negative ? 'negative' : 'positive', z: i < 3 ? 3 - i : 4 - i,
          areaStyle: { color: new echarts.graphic.LinearGradient(0, negative ? 1 : 0, 0, negative ? 0 : 1, [{ offset: 0, color: rgba(base, .75) }, { offset: 1, color: rgba(base, .25) }]) },
          data: data.map((value, i) => ({ value: [T + times[i] * HOUR, value] })) };
      });
      return [...values, { type: 'line', smooth: .4, id: 'usage', name: 'Consumption', color: colour('--primary-text-color'), lineStyle: { type: [7, 2], width: 1.5 }, z: 5, data: [.04, .64, null, .11, .55, .30].map((value, i) => ({ value: [T + times[i] * HOUR, value] })) }];
    }
    const periodData = (values: number[], compare: boolean) => values.map((value, i) => ({ value: [T + (i + .5) * HOUR, value, T + (compare ? -24 : 0) * HOUR + i * HOUR], itemStyle: { borderRadius: [4, 4, 0, 0] } }));
    // Shape: hui-energy-usage-graph-card.ts, including comparison placeholder.
    if (key === 'usage') {
      const make = (id: string, name: string, token: string, values: number[], compare = false) => { const base = colour(token); return { type: 'bar', cursor: 'default', id: `${compare ? 'compare-' : ''}${id}`, name, order: compare ? 0 : 1, stack: compare ? 'compare' : 'usage', barMaxWidth: 50, color: `${base}${compare ? '32' : '7F'}`, itemStyle: { borderColor: `${base}${compare ? '7F' : ''}` }, data: periodData(values, compare) }; };
      return [make('grid-from_grid', 'Grid energy', '--energy-grid-consumption-color', [1, 1.2, .7], true), { type: 'bar', id: 'compare-placeholder', data: [], stack: 'compare', order: 0 }, make('grid-from_grid', 'Grid energy', '--energy-grid-consumption-color', [1.4, 0, .8]), make('used_solar-used_solar', 'Solar energy', '--energy-solar-color', [.2, .6, .9]), make('grid-to_grid', 'Grid export', '--energy-grid-return-color', [0, -.1, -.3])];
    }
    // Shape: hui-energy-devices-graph-card.ts: colours on individual data points.
    if (key === 'devices') return [false, true].map(compare => ({ type: 'bar', id: compare ? 'Previous energy usage' : 'Energy usage', name: compare ? 'Previous energy usage' : 'Energy usage', barWidth: 10, itemStyle: { borderRadius: [0, 4, 4, 0] }, data: Object.keys(deviceNames).map((id, i) => { const base = graphColour(i); return { id, name: id, value: [(compare ? [1.1, .72, .03] : [1.25, .65, 0])[i], id], itemStyle: { color: `${base}${compare ? '32' : '7F'}`, borderColor: `${base}${compare ? '7F' : ''}`, ...(i === 0 ? { borderRadius: [0, 6, 6, 0] } : {}) } }; }) }));
    // Shape: energy-devices-detail-graph-data.ts. Numeric suffix is ordering,
    // not identity; current and comparison should keep the same source colour.
    if (key === 'many') {
      const make = (compare: boolean) => manyDevices.map(({ key, name }, order) => { const base = graphColour(order); return { type: 'bar', cursor: 'default', id: `${compare ? 'compare-' : ''}${key}-${order}`, name, itemStyle: { borderColor: `${base}${compare ? '7F' : ''}` }, barMaxWidth: 50, color: `${base}${compare ? '32' : '7F'}`, stack: compare ? 'devicesCompare' : 'devices', data: periodData([.03 + order / 100, .06 + (order % 5) / 100, .04 + (order % 7) / 100].map(value => Number((value * (compare ? .8 : 1)).toFixed(3))), compare) }; });
      return [...make(true), { id: 'compare-placeholder', type: 'bar', stack: 'devicesCompare', data: [] }, ...make(false)];
    }
    return [];
  }
  function legendData(key: Key, data: any[]) {
    if (key === 'devices') return Object.entries(deviceNames).map(([id, name], index) => ({ id, name, itemStyle: { color: `${graphColour(index)}7F`, borderColor: graphColour(index) } }));
    return data.filter(series => series.name && !String(series.id).startsWith('compare-') && !String(series.id).endsWith('-negative')).map(series => ({ id: series.id, name: series.name, secondaryIds: key === 'power' && ['grid', 'battery'].includes(series.id) ? [`${series.id}-negative`] : [`compare-${series.id}`], value: key === 'power' ? `${(series.data.at(-1)?.value ?? series.data.at(-1))?.[1] ?? 'Not available'} kW` : undefined, itemStyle: { color: key === 'power' && series.id !== 'usage' ? rgba(series.color || graphColour(0), .75) : series.color, borderColor: series.itemStyle?.borderColor ?? series.color } }));
  }
  const context: { locale: { language: string; number_format?: string; time_format?: string; time_zone?: string }; config: { time_zone: string } } = { locale: { language: 'en-GB' }, config: { time_zone: 'Europe/London' } };
  let day = 0;
  function paintTheme() {
    const p = palettes.palettes.find(item => item.id === palette.value)!;
    const name = `civica ${p.name} ${muted.input.checked ? 'Muted' : 'Vivid'}`;
    const theme = (source.themes as Record<string, any>)[name];
    for (const [key, value] of Object.entries({ ...theme, ...theme.modes[dark.input.checked ? 'dark' : 'light'] })) if (typeof value === 'string' && !key.startsWith('card-mod')) target.style.setProperty(`--${key}`, value);
    target.style.setProperty('--civica-chart-tone', muted.input.checked ? 'muted' : 'vivid');
    target.style.setProperty('--civica-chart-mode', dark.input.checked ? 'dark' : 'light');
  }
  paintTheme();
  function nativeTheme() {
    return { textStyle: { fontFamily: 'Roboto, Noto, sans-serif', fontSize: 12, color: colours()('--primary-text-color') }, line: { lineStyle: { width: 1.5 }, showSymbol: false, symbolSize: 1, symbol: 'circle', smooth: false }, bar: { itemStyle: { barBorderWidth: 1.5 } }, valueAxis: { axisLine: { lineStyle: { color: colours()('--divider-color') } }, splitLine: { lineStyle: { color: colours()('--divider-color') } } } };
  }
  function refresh() { lineWeight.hidden = !enabled.input.checked; updateEnergyCharts([panel], enabled.input.checked, context); }
  function renderNative(key: Key) {
    const host = hosts[key], legend = host.shadowRoot!.querySelector('.chart-legend ul')!; legend.replaceChildren();
    const rendered = host.data.map(series => ({ ...series, data: hidden[key].has(String(series.id)) ? undefined : key === 'devices' ? series.data.filter((point: any) => !hidden[key].has(point.id)) : series.data }));
    host.chart.setOption({ animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 500, ...host.options, legend: { show: false }, series: rendered }, { notMerge: true });
    for (const entry of host.options.legend?.data ?? []) {
      const item = element('li'); item.id = entry.id; item.classList.toggle('hidden', hidden[key].has(entry.id));
      const toggle = element('button'); toggle.className = 'legend-toggle'; toggle.type = 'button'; toggle.dataset.id = entry.id; toggle.title = `Toggle visibility: ${entry.name}`; toggle.setAttribute('aria-pressed', String(!hidden[key].has(entry.id)));
      const icon = document.createElement('ha-svg-icon'); icon.style.color = hidden[key].has(entry.id) ? '' : entry.itemStyle.color;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.4 10.6L10 14.2L17.6 6.6L19 8Z'); svg.append(path); icon.append(svg); toggle.append(icon);
      const label = element('button', entry.name); label.className = 'label'; label.type = 'button'; label.dataset.id = entry.id; label.title = entry.name;
      const toggleSeries = () => { nativeClicks.push(entry.id); for (const id of [entry.id, ...(entry.secondaryIds ?? [])]) { if (hidden[key].has(id)) hidden[key].delete(id); else hidden[key].add(id); } renderNative(key); refresh(); };
      toggle.onclick = toggleSeries; label.onclick = toggleSeries;
      item.append(toggle, label); if (entry.value) { const value = element('div', entry.value); value.className = 'value'; item.append(value); } legend.append(item);
    }
  }
  for (const [key, tag, title] of specs) {
    // Standalone documentation examples isolate one chart while sharing the
    // same renderer, native-shaped fixture data and production adapter.
    if (target.dataset.exampleChart && target.dataset.exampleChart !== key) continue;
    const card = document.createElement(tag), cardRoot = card.attachShadow({ mode: 'open' }); cards[key] = card;
    const shell = document.createElement('ha-card'), heading = element('h2', title); heading.className = 'card-header';
    const description = element('p', descriptions[key]); description.className = 'chart-description';
    const content = element('div'); content.className = 'content';
    const host = document.createElement('ha-chart-base') as DemoHost; host.attachShadow({ mode: 'open' });
    const plot = element('div'); plot.className = 'chart'; plot.setAttribute('role', 'img'); plot.setAttribute('aria-label', `${title}. Use View data for all example values.`); plots[key] = plot;
    const legend = element('div'); legend.className = 'chart-legend multiple-items'; legend.append(element('ul'));
    const container = element('div'); container.className = 'container'; const plotContainer = element('div'); plotContainer.className = 'chart-container'; plotContainer.append(plot); container.append(plotContainer, legend);
    host.shadowRoot!.append(element('style', CHART_STYLE), container); content.append(host); shell.append(heading, description, content); cardRoot.append(element('style', CARD_STYLE), shell); examples.append(card);
    host.data = dataset(key); host.options = nativeOptions(key); host.options.legend.data = legendData(key, host.data);
    host.sonificationLabelFormatter = id => deviceNames[id] ?? manyDevices.find(item => item.key === id)?.name;
    host.chart = echarts.init(plot, nativeTheme(), { renderer: 'canvas' }); hosts[key] = host;
    renderNative(key);
    if (key === 'empty') { const empty = element('p', 'No example values for this period.'); empty.className = 'empty'; host.shadowRoot!.append(empty); }
  }
  const resize = new ResizeObserver(() => Object.values(hosts).forEach(host => { if (!host.chart.isDisposed()) host.chart.resize(); })); resize.observe(target);
  function changeTheme() {
    paintTheme();
    // A native theme update regenerates source presentation. Retain dates and
    // values, so a palette change cannot quietly reset the selected period.
    for (const key of Object.keys(hosts) as Key[]) {
      const templates = dataset(key);
      hosts[key].data = hosts[key].data.map(series => {
        const template = templates.find(item => item.id === series.id); if (!template) return series;
        return { ...series, color: template.color, itemStyle: template.itemStyle, areaStyle: template.areaStyle, data: series.data.map((point: any, index: number) => point && !Array.isArray(point) && typeof point === 'object' ? { ...point, itemStyle: template.data[index]?.itemStyle } : point) };
      });
      hosts[key].options = { ...hosts[key].options, legend: { ...hosts[key].options.legend, data: legendData(key, hosts[key].data) } };
      renderNative(key);
    }
    refresh();
  }
  palette.onchange = muted.input.onchange = dark.input.onchange = changeTheme; enabled.input.onchange = refresh;
  nextDay.onclick = () => {
    day++;
    for (const key of ['power', 'usage', 'many'] as Key[]) {
      if (!hosts[key]) continue;
      const host = hosts[key]; host.data = dataset(key).map(series => ({ ...series, data: series.data.map((point: any) => { const values = point.value ?? point, shifted = values.map((value: any, i: number) => i === 0 || i === 2 ? value + day * 24 * HOUR : value); return point.value ? { ...point, value: shifted } : shifted; }) }));
      host.options = { ...host.options, xAxis: { ...host.options.xAxis, min: T + day * 24 * HOUR, max: T + day * 24 * HOUR + 3 * HOUR } };
      const date = (offset: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' }).format(T + offset * 24 * HOUR);
      cards[key].shadowRoot!.querySelector('.chart-description')!.textContent = `Invented example values from midnight to 3am on ${date(day)}${key === 'power' ? '' : `, compared with ${date(day - 1)}`} (Europe/London). See the table for the original times, period starts and units.`;
      renderNative(key);
    }
    refresh();
  };
  refresh();
  return {
    panel, hosts, cards, nativeClicks, refresh, manyDevices, presentationSpec: ENERGY_CHART_SPEC, renderer: 'canvas', frontend: '20261028.5',
    sharedColour: (key: string) => chartColour(key, { tone: muted.input.checked ? 'muted' : 'vivid', mode: dark.input.checked ? 'dark' : 'light' }),
    sharedStyle: (key: string) => chartSeriesStyle(key, { tone: muted.input.checked ? 'muted' : 'vivid', mode: dark.input.checked ? 'dark' : 'light' }),
    setActive(active: boolean) { enabled.input.checked = active; refresh(); },
    setMode(mode: 'light' | 'dark') { dark.input.checked = mode === 'dark'; changeTheme(); },
    setTone(tone: 'vivid' | 'muted') { muted.input.checked = tone === 'muted'; changeTheme(); },
    setPalette(id: string) { palette.value = id; changeTheme(); },
    setPreferences(preferences: Partial<typeof context.locale>) { Object.assign(context.locale, preferences); refresh(); },
    replaceData(key: Key, data: any[], options?: any) { hosts[key].data = data; hosts[key].options = options ?? { ...hosts[key].options, legend: { ...hosts[key].options.legend, data: legendData(key, data) } }; renderNative(key); refresh(); },
    recreateChart(key: Key) { if (!hosts[key].chart.isDisposed()) hosts[key].chart.dispose(); hosts[key].chart = echarts.init(plots[key], nativeTheme(), { renderer: 'canvas' }); renderNative(key); refresh(); },
    dispose() { updateEnergyCharts([], false); resize.disconnect(); Object.values(hosts).forEach(host => host.chart.dispose()); root.replaceChildren(); setup.delete(target); },
  };
}
export function initialiseEnergyExamples(target: HTMLElement) {
  let fixture = setup.get(target); if (!fixture) { fixture = build(target); setup.set(target, fixture); } return fixture;
}
declare global { interface Window { energyFixture?: ReturnType<typeof build> } }
for (const target of document.querySelectorAll<HTMLElement>('[data-civica-energy-examples]')) window.energyFixture ??= initialiseEnergyExamples(target);
