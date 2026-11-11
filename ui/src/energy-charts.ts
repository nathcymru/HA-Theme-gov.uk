import { removeEnergyChartData, updateEnergyChartData } from './energy-chart-data';

// Presentation contract: ONS Design System 74.0.0, chart components, mapped to
// HA Frontend 20261028.5's public ha-chart-base ECharts instance. Keep the native
// renderer, data, formatters, Chart2Music, legend actions, zoom and date controls.
export const ENERGY_CHART_SPEC = Object.freeze({
  source: 'https://github.com/ONSdigital/design-system/tree/74.0.0/src/components/chart',
  frontend: '20261028.5',
  fontFamily: 'Arial, Helvetica, sans-serif', // civica.uk's documented typeface
  minimumFontSize: 14,
  lineWidth: 3,
  gridWidth: 1,
  zeroLineWidth: 1.5,
  minimumPlotHeight: 280,
  light: { text: '#414042', axis: '#707071', grid: '#D9D9D9', zero: '#B3B3B3' },
  dark: { text: '#FFFFFF', axis: '#CBD0D3', grid: '#50565A', zero: '#9BA4AA' },
});

export const ENERGY_CHART_HOSTS = Object.freeze([
  'hui-power-sources-graph-card', 'hui-energy-usage-graph-card',
  'hui-energy-solar-graph-card', 'hui-energy-gas-graph-card',
  'hui-energy-water-graph-card', 'hui-energy-devices-graph-card',
  'hui-energy-devices-detail-graph-card',
]);

type Options = Record<string, any>;
type Path = (string | number)[];
interface Chart {
  getOption(): Options;
  setOption(options: Options, flags?: Options): void;
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  isDisposed?(): boolean;
  resize?(): void;
  convertToPixel?(finder: Options, value: number): number | number[];
  containPixel?(finder: Options, value: number[]): boolean;
  getWidth?(): number;
  getHeight?(): number;
}
interface ChartHost extends HTMLElement {
  chart?: Chart;
  height?: string;
  data?: any[];
  options?: Options;
  sonificationLabelFormatter?: (label: string) => string | undefined;
}
interface HassContext {
  locale?: { language?: string; number_format?: string; time_format?: string; time_zone?: string };
  config?: { time_zone?: string };
}
interface OwnedValue { path: Path; original: any; applied: any }
interface ChartState {
  host: ChartHost;
  card: HTMLElement;
  panel: HTMLElement;
  chart?: Chart;
  failedChart?: Chart;
  owned: Map<string, OwnedValue>;
  finished: () => void;
  queued: boolean;
  stopped: boolean;
  resize: ResizeObserver;
  nativeHeight?: { original: string; priority: string; applied: string };
  label?: { node: Element; original: string; applied: string };
}
interface PanelState { observers: Map<ShadowRoot, MutationObserver>; queued: boolean }

const panels = new Map<HTMLElement, PanelState>();
const charts = new Map<ChartHost, ChartState>();
const sheets = new Map<ShadowRoot, CSSStyleSheet>();
const sheetPanels = new Map<ShadowRoot, HTMLElement>();
let context: HassContext = {};
let chartSheet: CSSStyleSheet | undefined;
let cardSheet: CSSStyleSheet | undefined;

const CHART_CSS = `
:host { --chart-max-height:none; font-family:Arial,Helvetica,sans-serif; }
.container.has-height { max-height:none; min-height:280px; height:auto!important; }
.chart-container { min-height:max(280px,var(--civica-energy-native-height,0px)); max-height:none; }
.chart-legend { order:-1; padding:0 0 12px; font-family:Arial,Helvetica,sans-serif; font-size:max(14px,calc(14px * var(--ha-font-size-scale,1))); line-height:1.2; }
.chart-legend ul { justify-content:flex-start; gap:4px 12px; }
.chart-legend li { height:auto; min-height:44px; overflow:visible; }
.chart-legend .legend-toggle { width:44px; min-height:44px; padding:10px; margin:0; flex:none; }
.chart-legend .legend-toggle ha-svg-icon { --mdc-icon-size:12px; }
.chart-legend .label { min-height:44px; line-height:1.2; }
.chart-legend .value { line-height:1.2; }
.top-controls { position:relative; top:auto; inset-inline:auto; order:-2; min-height:0; }
.chart:focus-visible,.chart-legend .legend-toggle:focus-visible,.chart-legend .label:focus-visible { outline:3px solid var(--ha-color-focus,#ffdd00); outline-offset:2px; box-shadow:0 0 0 5px var(--civica-focus-text,#0b0c0c); border-radius:0; }
@media(forced-colors:active) { .chart:focus-visible,.chart-legend .legend-toggle:focus-visible,.chart-legend .label:focus-visible { outline-color:Highlight; box-shadow:none; } }
`;
const CARD_CSS = `
.card-header,:host ::slotted(.card-header) { font-family:Arial,Helvetica,sans-serif; font-size:var(--civica-font-size-heading,24px); font-weight:700; line-height:1.25; letter-spacing:normal; }
`;

const array = (value: any): any[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const at = (object: any, path: Path): any => path.reduce((value, key) => value?.[key], object);
const equal = (one: any, two: any): boolean => one === two || Array.isArray(one) && Array.isArray(two) && one.length === two.length && one.every((value, i) => equal(value, two[i]));

function keyFor(path: Path, option: Options) {
  const pieces = [...path];
  if (typeof pieces[1] === 'number') {
    const component = option[pieces[0]]?.[pieces[1]];
    pieces[1] = JSON.stringify([component?.id ?? pieces[1], component?.type]);
    // A date change can replace the point at the same index. Never restore a
    // previous period's cap onto a new point, or retain unbounded old records.
    if (path[0] === 'series' && path[2] === 'data') pieces[3] = JSON.stringify(component?.data?.[path[3]]?.value ?? component?.data?.[path[3]]);
  }
  return JSON.stringify(pieces);
}

function writePatch(patch: Options, option: Options, path: Path, value: any) {
  if (path[0] === 'series' && path[2] === 'data') {
    const index = Number(path[1]);
    patch.series ||= [];
    while (patch.series.length <= index) {
      const native = option.series[patch.series.length];
      patch.series.push(native.id === undefined ? {} : { id: native.id });
    }
    const series = patch.series[index];
    // ECharts replaces a data array rather than merging each point. Copy all
    // existing rendered values intact, changing only a point's visual cap.
    series.data ||= option.series[index].data.map((point: any) => point && typeof point === 'object' && !Array.isArray(point)
      ? { ...point, itemStyle: { ...point.itemStyle } } : point);
    series.data[Number(path[3])].itemStyle[path[5]] = value;
    return;
  }
  let target: any = patch;
  let source: any = option;
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i];
    if (Array.isArray(target) && typeof part === 'number') {
      while (target.length <= part) {
        const native = source?.[target.length];
        target.push(native?.id === undefined ? {} : { id: native.id });
      }
    }
    target[part] ??= typeof path[i + 1] === 'number' ? [] : {};
    target = target[part]; source = source?.[part];
  }
  target[path[path.length - 1]] = value;
}

function crossesVisibleZero(chart: Chart | undefined, axisName: string, axis: Options, option: Options) {
  if (!chart?.convertToPixel || !chart.containPixel || !chart.getWidth || !chart.getHeight || axis.axisLine?.onZero === false) return false;
  const otherName = axisName === 'xAxis' ? 'yAxis' : 'xAxis';
  const other = array(option[otherName]);
  const candidates = other.map((value, index) => ({ value, index })).filter(item => item.value.type === 'value');
  const explicit = axis.axisLine?.onZeroAxisIndex;
  const target = typeof explicit === 'number' ? { value: other[explicit], index: explicit } : candidates.length === 1 ? candidates[0] : undefined;
  if (!target?.value || target.value.type !== 'value') return false;
  // Use the rendered scale through public ECharts APIs, not guessed min/max
  // callbacks or data extents. If zero lies outside the current zoom/range,
  // onZero falls back to an edge and that edge must remain an ordinary rule.
  const pixel = chart.convertToPixel({ [`${otherName}Index`]: target.index }, 0);
  if (typeof pixel !== 'number' || !Number.isFinite(pixel)) return false;
  const point = otherName === 'xAxis' ? [pixel, chart.getHeight() / 2] : [chart.getWidth() / 2, pixel];
  return chart.containPixel({ gridIndex: target.value.gridIndex ?? axis.gridIndex ?? 0 }, point);
}

function presentation(state: ChartState, option: Options) {
  const style = getComputedStyle(state.host);
  const dark = style.getPropertyValue('--primary-text-color').trim().toLowerCase() === '#ffffff'
    || style.getPropertyValue('--primary-text-color').trim().toLowerCase() === '#fff';
  const colours = dark ? ENERGY_CHART_SPEC.dark : ENERGY_CHART_SPEC.light;
  const fontSize = ENERGY_CHART_SPEC.minimumFontSize * Math.max(1, Number.parseFloat(style.getPropertyValue('--ha-font-size-scale')) || 1);
  const narrow = state.host.clientWidth <= 500;
  const changes: { path: Path; value: any }[] = [];
  const set = (path: Path, value: any) => changes.push({ path, value });
  set(['animation'], false);
  set(['animationDuration'], 0);
  set(['animationDurationUpdate'], 0);
  set(['textStyle', 'fontFamily'], ENERGY_CHART_SPEC.fontFamily);
  set(['textStyle', 'fontSize'], fontSize);
  set(['textStyle', 'color'], colours.text);
  for (const axisName of ['xAxis', 'yAxis']) {
    array(option[axisName]).forEach((axis, index) => {
      if (!axis || axis.show === false) return;
      const numeric = axis.type === 'value' || axis.type === 'log';
      const path = [axisName, index];
      for (const part of ['axisLabel', 'nameTextStyle']) {
        set([...path, part, 'fontFamily'], ENERGY_CHART_SPEC.fontFamily);
        set([...path, part, 'fontSize'], fontSize);
        set([...path, part, 'lineHeight'], fontSize * 1.2);
        set([...path, part, 'color'], numeric || axis.type === 'time' ? colours.axis : colours.text);
      }
      set([...path, 'axisLabel', 'rotate'], 0);
      set([...path, 'axisLabel', 'hideOverlap'], true);
      set([...path, 'splitLine', 'show'], numeric);
      set([...path, 'splitLine', 'lineStyle', 'color'], colours.grid);
      set([...path, 'splitLine', 'lineStyle', 'width'], ENERGY_CHART_SPEC.gridWidth);
      set([...path, 'splitLine', 'lineStyle', 'type'], 'solid');
      // The category/time axis crosses the numerical axis at zero. Do not
      // invent a zero tick, or change native min/max/precision to draw one.
      const zero = !numeric && crossesVisibleZero(state.chart, axisName, axis, option);
      set([...path, 'axisLine', 'show'], !numeric);
      set([...path, 'axisLine', 'lineStyle', 'color'], zero ? colours.zero : colours.grid);
      set([...path, 'axisLine', 'lineStyle', 'width'], zero ? ENERGY_CHART_SPEC.zeroLineWidth : ENERGY_CHART_SPEC.gridWidth);
      set([...path, 'axisTick', 'show'], axis.type === 'time');
      set([...path, 'axisTick', 'lineStyle', 'color'], colours.grid);
      set([...path, 'axisTick', 'lineStyle', 'width'], ENERGY_CHART_SPEC.gridWidth);
    });
  }
  array(option.series).forEach((series, index) => {
    const path = ['series', index];
    if (series.type === 'line') {
      set([...path, 'lineStyle', 'width'], ENERGY_CHART_SPEC.lineWidth);
      set([...path, 'lineStyle', 'cap'], 'round');
      // Preserve native dash, stack, area, connectNulls and comparison meaning.
    } else if (series.type === 'bar') {
      set([...path, 'itemStyle', 'borderRadius'], 0);
      set([...path, 'itemStyle', 'borderWidth'], 0);
      set([...path, 'barMaxWidth'], narrow ? 55 : 75);
      set([...path, 'barCategoryGap'], array(series.data).length >= (narrow ? 10 : 20) ? '20%' : '40%');
      array(series.data).forEach((point, pointIndex) => {
        if (point?.itemStyle?.borderRadius !== undefined) set([...path, 'data', pointIndex, 'itemStyle', 'borderRadius'], 0);
      });
    }
  });
  return changes;
}

function restore(state: ChartState) {
  if (!state.chart || state.chart.isDisposed?.()) { state.owned.clear(); return; }
  const option = state.chart.getOption();
  const patch: Options = {};
  for (const [key, record] of state.owned) {
    if (keyFor(record.path, option) !== key || !equal(at(option, record.path), record.applied)) continue;
    // null returns an absent inherited presentation field to its native
    // fallback; an undefined merge would leave our previous value installed.
    writePatch(patch, option, record.path, record.original === undefined ? null : record.original);
  }
  state.owned.clear();
  if (Object.keys(patch).length) state.chart.setOption(patch, { silent: true });
}

function detachChart(state: ChartState, reset: boolean) {
  // HA may dispose/recreate its renderer between an event and this microtask.
  // An internal API race must never break the native panel or companion.
  try { state.chart?.off('finished', state.finished); } catch { /* Already disposed. */ }
  if (reset) { try { restore(state); } catch { /* Native renderer no longer accepts options. */ } }
  state.owned.clear();
  state.chart = undefined;
}

function cardTitle(card: HTMLElement) {
  const native = card.shadowRoot?.querySelector<HTMLElement & { header?: string }>('ha-card');
  const heading = card.shadowRoot?.querySelector('.card-header') || native?.shadowRoot?.querySelector('.card-header');
  // A header can also contain the changing total chip; use its title span.
  return (heading?.querySelector(':scope > span') || heading)?.textContent?.trim()
    || native?.header?.trim() || native?.getAttribute('header')?.trim() || '';
}

function restoreDom(state: ChartState) {
  if (state.label && state.label.node.getAttribute('aria-label') === state.label.applied) state.label.node.setAttribute('aria-label', state.label.original);
  state.label = undefined;
  if (state.nativeHeight && state.host.style.getPropertyValue('--civica-energy-native-height') === state.nativeHeight.applied) {
    if (state.nativeHeight.original) state.host.style.setProperty('--civica-energy-native-height', state.nativeHeight.original, state.nativeHeight.priority);
    else state.host.style.removeProperty('--civica-energy-native-height');
  }
  state.nativeHeight = undefined;
}

function updateDom(state: ChartState, title: string) {
  const height = state.host.height && CSS.supports('height', state.host.height) ? state.host.height : '0px';
  if (!state.nativeHeight) state.nativeHeight = { original: state.host.style.getPropertyValue('--civica-energy-native-height'), priority: state.host.style.getPropertyPriority('--civica-energy-native-height'), applied: height };
  if (state.host.style.getPropertyValue('--civica-energy-native-height') !== height) state.host.style.setProperty('--civica-energy-native-height', height);
  state.nativeHeight.applied = height;
  const plot = state.host.shadowRoot?.querySelector('.chart[aria-label]');
  if (state.label && (state.label.node !== plot || !title)) {
    if (state.label.node.getAttribute('aria-label') === state.label.applied) state.label.node.setAttribute('aria-label', state.label.original);
    state.label = undefined;
  }
  if (!plot || !title) return;
  const current = plot.getAttribute('aria-label') || '';
  const original = state.label && current === state.label.applied ? state.label.original : current;
  const label = original.toLocaleLowerCase().includes(title.toLocaleLowerCase()) ? original : `${title}. ${original}`;
  if (label !== current) plot.setAttribute('aria-label', label);
  state.label = { node: plot, original, applied: label };
}

function syncChart(state: ChartState) {
  if (state.stopped || !state.host.isConnected) return;
  const chart = state.host.chart;
  if (chart && chart === state.failedChart) return;
  if (!chart || typeof chart.getOption !== 'function' || typeof chart.setOption !== 'function' || typeof chart.on !== 'function' || typeof chart.off !== 'function' || chart.isDisposed?.()) {
    detachChart(state, false);
    restoreDom(state);
    removeEnergyChartData(state.host);
    if (state.host.shadowRoot) removeSheet(state.host.shadowRoot);
    delete state.host.dataset.civicaEnergyChart;
    return;
  }
  if (chart !== state.chart) {
    detachChart(state, true);
    state.failedChart = undefined;
    state.chart = chart;
    chart.on('finished', state.finished);
  }
  const option = chart.getOption();
  const series = array(option.series);
  // Only Cartesian Energy bars/lines are covered. Pie, Sankey and custom
  // renderers keep native presentation, rather than receiving guessed axes.
  if (series.some(item => !['bar', 'line'].includes(item.type))) {
    restore(state); removeEnergyChartData(state.host);
    restoreDom(state);
    if (state.host.shadowRoot) removeSheet(state.host.shadowRoot);
    delete state.host.dataset.civicaEnergyChart;
    return;
  }
  if (state.host.shadowRoot) addSheet(state.host.shadowRoot, 'chart', state.panel);
  const title = cardTitle(state.card);
  updateDom(state, title);
  const patch: Options = {};
  const visited = new Set<string>();
  for (const { path, value } of presentation(state, option)) {
    const key = keyFor(path, option); visited.add(key);
    const current = at(option, path);
    const previous = state.owned.get(key);
    if (previous) previous.path = path;
    if (equal(current, value)) continue;
    state.owned.set(key, { path, original: previous && equal(current, previous.applied) ? previous.original : current, applied: value });
    writePatch(patch, option, path, value);
  }
  for (const key of state.owned.keys()) if (!visited.has(key)) state.owned.delete(key);
  if (Object.keys(patch).length) chart.setOption(patch, { silent: true });
  state.host.dataset.civicaEnergyChart = ENERGY_CHART_SPEC.frontend;
  delete state.host.dataset.civicaEnergyError;
  updateEnergyChartData(state.host, {
    title: title || 'Energy chart', locale: context.locale?.language, timeZone: context.config?.time_zone,
    numberFormat: context.locale?.number_format, timeFormat: context.locale?.time_format,
    timeZonePreference: context.locale?.time_zone,
  });
}

function queueChart(state: ChartState) {
  if (state.queued || state.stopped) return;
  state.queued = true;
  queueMicrotask(() => {
    state.queued = false;
    try { syncChart(state); } catch {
      const failed = state.chart || state.host.chart;
      detachChart(state, true);
      state.failedChart = failed;
      restoreDom(state);
      if (state.host.shadowRoot) removeSheet(state.host.shadowRoot);
      removeEnergyChartData(state.host);
      delete state.host.dataset.civicaEnergyChart;
      state.host.dataset.civicaEnergyError = 'native-chart-contract';
    }
  });
}

function addSheet(root: ShadowRoot, kind: 'chart' | 'card', panel: HTMLElement) {
  if (sheets.has(root)) return;
  if (kind === 'chart' && !chartSheet) { chartSheet = new CSSStyleSheet(); chartSheet.replaceSync(CHART_CSS); }
  if (kind === 'card' && !cardSheet) { cardSheet = new CSSStyleSheet(); cardSheet.replaceSync(CARD_CSS); }
  const sheet = (kind === 'chart' ? chartSheet : cardSheet)!;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  sheets.set(root, sheet);
  sheetPanels.set(root, panel);
}

function removeSheet(root: ShadowRoot) {
  const sheet = sheets.get(root);
  if (sheet) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(item => item !== sheet);
  sheets.delete(root); sheetPanels.delete(root);
}

function stopChart(state: ChartState) {
  state.stopped = true; state.resize.disconnect();
  detachChart(state, true);
  restoreDom(state);
  if (state.host.shadowRoot) removeSheet(state.host.shadowRoot);
  delete state.host.dataset.civicaEnergyChart;
  delete state.host.dataset.civicaEnergyError;
  removeEnergyChartData(state.host);
  charts.delete(state.host);
}

function discover(panel: HTMLElement, state: PanelState) {
  if (!panel.isConnected || !panels.has(panel)) return;
  const seenRoots = new Set<ShadowRoot>();
  const seenCharts = new Set<ChartHost>();
  const walk = (root: ShadowRoot, card?: HTMLElement) => {
    seenRoots.add(root);
    if (!state.observers.has(root)) {
      const observer = new MutationObserver(() => {
        if (state.queued) return;
        state.queued = true;
        queueMicrotask(() => { state.queued = false; discover(panel, state); });
      });
      observer.observe(root, { childList: true, subtree: true });
      state.observers.set(root, observer);
    }
    for (const node of root.querySelectorAll<HTMLElement>('*')) {
      if (node.closest('.civica-energy-data')) continue;
      const owner = ENERGY_CHART_HOSTS.includes(node.localName) ? node : card;
      if (owner && node.localName === 'ha-chart-base' && node.shadowRoot) {
        const host = node as ChartHost;
        seenCharts.add(host);
        if (!charts.has(host)) {
          const next = { host, card: owner, panel, owned: new Map(), queued: false, stopped: false } as ChartState;
          next.finished = () => queueChart(next);
          next.resize = new ResizeObserver(() => queueChart(next));
          next.resize.observe(host); charts.set(host, next);
        }
        queueChart(charts.get(host)!);
      }
      if (node.shadowRoot) {
        if (owner && (node === owner || node.localName === 'ha-card')) addSheet(node.shadowRoot, 'card', panel);
        walk(node.shadowRoot, owner);
      }
    }
  };
  if (panel.shadowRoot) walk(panel.shadowRoot);
  for (const [root, observer] of state.observers) if (!seenRoots.has(root)) { observer.disconnect(); state.observers.delete(root); }
  for (const tracked of charts.values()) if (tracked.panel === panel && !seenCharts.has(tracked.host)) stopChart(tracked);
  for (const root of sheets.keys()) if (sheetPanels.get(root) === panel && !seenRoots.has(root)) removeSheet(root);
}

export function updateEnergyCharts(roots: readonly HTMLElement[], active: boolean, hass?: HassContext) {
  context = hass || {};
  const current = new Set(active ? roots.filter(panel => panel.localName === 'ha-panel-energy' && panel.isConnected) : []);
  for (const [panel, state] of panels) if (!current.has(panel)) {
    for (const observer of state.observers.values()) observer.disconnect();
    panels.delete(panel);
    for (const tracked of charts.values()) if (tracked.panel === panel) stopChart(tracked);
    for (const root of sheets.keys()) if (sheetPanels.get(root) === panel) removeSheet(root);
  }
  if (!current.size) {
    for (const state of charts.values()) stopChart(state);
    for (const root of sheets.keys()) removeSheet(root);
    return;
  }
  for (const panel of current) {
    if (!panels.has(panel)) panels.set(panel, { observers: new Map(), queued: false });
    discover(panel, panels.get(panel)!);
  }
}
