import { removeEnergyChartData, updateEnergyChartData } from './energy-chart-data';
import { chartSeriesStyle } from '../../design-system/chart-colours.mjs';
import { projectPowerSeries } from './energy-power-series';

// Presentation contract: ONS Design System 74.0.0, chart components, mapped to
// HA Frontend 20261028.5's public ha-chart-base ECharts instance. Keep the native
// renderer, data, formatters, Chart2Music, legend actions, zoom and date controls.
export const ENERGY_CHART_SPEC = Object.freeze({
  source: 'https://github.com/ONSdigital/design-system/tree/74.0.0/src/components/chart',
  frontend: '20261028.5',
  fontFamily: 'Arial, Helvetica, sans-serif', // civica.uk's documented typeface
  minimumFontSize: 14,
  lineWidth: 1.5, // Dense native Energy charts; ONS standalone reference is 3px.
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
  themes?: { theme?: string; default_theme?: string; darkMode?: boolean };
  selectedTheme?: { theme?: string; dark?: boolean };
}
interface OwnedValue { path: Path; original: any; applied: any }
interface PowerProjection { source: any[][]; readings: any[][]; applied: any[][] }
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
  keys: Map<HTMLElement, { marker: SVGSVGElement; signature: string }>;
  power: Map<string, PowerProjection>;
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
.chart-legend .legend-toggle[data-civica-key] ha-svg-icon { display:none; }
.civica-chart-key { display:block; flex:none; width:24px; height:16px; overflow:visible; }
.chart-legend .legend-toggle[aria-pressed="false"] .civica-chart-key { outline:1px dashed currentColor; outline-offset:1px; }
.chart-legend .label { min-height:44px; line-height:1.2; }
.chart-legend .value { font-size:max(14px,calc(14px * var(--ha-font-size-scale,1))); line-height:1.2; }
.top-controls { position:relative; top:auto; inset-inline:auto; order:-2; min-height:0; }
.chart:focus-visible,.chart-legend .legend-toggle:focus-visible,.chart-legend .label:focus-visible { outline:3px solid var(--ha-color-focus,#ffdd00); outline-offset:2px; box-shadow:0 0 0 5px var(--civica-focus-text,#0b0c0c); border-radius:0; }
@media(forced-colors:active) { .chart:focus-visible,.chart-legend .legend-toggle:focus-visible,.chart-legend .label:focus-visible { outline-color:Highlight; box-shadow:none; } }
`;
const CARD_CSS = `
.card-header,:host ::slotted(.card-header) { font-family:Arial,Helvetica,sans-serif; font-size:var(--civica-font-size-heading,24px); font-weight:700; line-height:1.25; letter-spacing:normal; }
`;

const array = (value: any): any[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const at = (object: any, path: Path): any => path.reduce((value, key) => value?.[key], object);
const equal = (one: any, two: any): boolean => {
  if (one === two) return true;
  if (!one || !two || typeof one !== 'object' || typeof two !== 'object') return false;
  if (Array.isArray(one) || Array.isArray(two)) return Array.isArray(one) && Array.isArray(two) && one.length === two.length && one.every((value, i) => equal(value, two[i]));
  // ECharts may mark a decal dirty while rendering it; this is not paint.
  const a = Object.keys(one).filter(key => key !== 'dirty'), b = Object.keys(two).filter(key => key !== 'dirty');
  return a.length === b.length && a.every(key => Object.hasOwn(two, key) && equal(one[key], two[key]));
};

function keyFor(path: Path, option: Options) {
  const pieces = [...path];
  if (typeof pieces[1] === 'number') {
    const component = option[pieces[0]]?.[pieces[1]];
    pieces[1] = JSON.stringify([component?.id ?? pieces[1], component?.type]);
    // Paint belongs to a device or timestamp, not an array position or a
    // reading's magnitude. This also survives the signed Power projection.
    if (path[0] === 'series' && path[2] === 'data') {
      const point = component?.data?.[path[3]], value = point?.value ?? point;
      pieces[3] = JSON.stringify([point?.id ?? point?.name ?? value?.[0], value?.[2]]);
    }
  }
  return JSON.stringify(pieces);
}

function writePatch(patch: Options, option: Options, path: Path, value: any) {
  if (path[0] === 'series' && path[2] === 'data' && path.length > 3) {
    const index = Number(path[1]);
    patch.series ||= [];
    while (patch.series.length <= index) {
      const native = option.series[patch.series.length];
      patch.series.push(native.id === undefined ? {} : { id: native.id });
    }
    const series = patch.series[index];
    // ECharts replaces a data array rather than merging each point. Copy all
    // existing rendered values intact, changing only a point's visual cap.
    series.data ||= option.series[index].data.map((point: any) => point && typeof point === 'object' && !Array.isArray(point) ? { ...point } : point);
    let target = series.data[Number(path[3])];
    let source = option.series[index].data[Number(path[3])];
    for (let i = 4; i < path.length - 1; i++) {
      const key = path[i];
      if (!target[key] || target[key] === source?.[key]) target[key] = { ...source?.[key] };
      target = target[key]; source = source?.[key];
    }
    target[path[path.length - 1]] = value;
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

function chartContext(style: CSSStyleDeclaration) {
  const selected = context.themes?.theme || context.selectedTheme?.theme || context.themes?.default_theme || '';
  const tone = style.getPropertyValue('--civica-chart-tone').trim() || style.getPropertyValue('--civica-tone').trim();
  const mode = style.getPropertyValue('--civica-chart-mode').trim();
  const text = style.getPropertyValue('--primary-text-color').trim().toLowerCase();
  return {
    tone: (tone ? tone === 'muted' : selected.endsWith(' Muted')) ? 'muted' as const : 'vivid' as const,
    mode: (mode ? mode === 'dark' : context.themes?.darkMode ?? (text === '#ffffff' || text === '#fff')) ? 'dark' as const : 'light' as const,
  };
}

const usageRoles: Record<string, string> = {
  from_grid: 'grid-consumption', used_grid: 'grid-consumption', to_grid: 'grid-return',
  used_solar: 'solar', to_battery: 'battery-in', from_battery: 'battery-out',
  used_battery: 'battery-out', used_home: 'consumption',
};
function sourceSeries(state: ChartState, series: Options, index: number): Options {
  return state.host.data?.find(value => value.id !== undefined && value.id === series.id) || state.host.data?.[index] || series;
}
function seriesPaint(state: ChartState, series: Options, index: number, point?: Options) {
  const native = sourceSeries(state, series, index);
  const raw = String(native.id ?? native.name ?? series.id ?? `series-${index}`);
  const compare = raw.startsWith('compare-') || /^compare|Compare$/.test(String(native.stack || ''))
    || state.card.localName === 'hui-energy-devices-graph-card' && index === 1;
  const forecast = raw.startsWith('forecast-');
  let key = raw.replace(/^(compare-|forecast-)/, '');
  const power = state.card.localName === 'hui-power-sources-graph-card';
  const total = power && key === 'usage';
  if (power) key = ({ grid: 'grid-consumption', solar: 'solar', battery: 'battery-out', usage: 'consumption' } as Record<string, string>)[key.replace(/-negative$/, '')] || key.replace(/-negative$/, '');
  else if (state.card.localName === 'hui-energy-usage-graph-card') {
    for (const [type, role] of Object.entries(usageRoles)) if (key === type || key.endsWith(`-${type}`)) {
      const statistic = key === type ? '' : key.slice(0, -type.length - 1);
      key = !statistic || [type, 'grid', 'solar', 'battery', role].includes(statistic) ? role : `${role}:${statistic}`;
      break;
    }
  } else if (state.card.localName === 'hui-energy-devices-detail-graph-card') key = key.replace(/-\d+$/, '');
  else if (state.card.localName === 'hui-energy-gas-graph-card') key = key === 'gas' ? 'gas' : `gas:${key}`;
  else if (state.card.localName === 'hui-energy-water-graph-card') key = key === 'water' ? 'water' : `water:${key}`;
  else if (state.card.localName === 'hui-energy-solar-graph-card') key = key === 'solar' ? 'solar' : `solar:${key}`;
  if (point) {
    const identity = point.id ?? point.name ?? (typeof point.value?.[1] === 'string' ? point.value[1] : undefined);
    if (identity !== undefined) key = String(identity).replace(/^compare-/, '');
  }
  const palette = chartSeriesStyle(key, chartContext(getComputedStyle(state.host)));
  const deviceCategories = ['hui-energy-devices-graph-card', 'hui-energy-devices-detail-graph-card'].includes(state.card.localName);
  const basePattern = deviceCategories ? palette.pattern : 'solid';
  const pattern = compare ? basePattern === 'diagonal' ? 'reverse-diagonal' : 'diagonal' : basePattern;
  const dash = total ? palette.lineDash : forecast ? [7, 5] : compare ? [4, 3] : palette.lineDash;
  return { ...palette, key, pattern, dash, compare, power, total, forecast };
}

function patternInk(colour: string) {
  const rgb = colour.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = rgb.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  return luminance > .18 ? '#0B0C0C' : '#FFFFFF';
}
const crossPath = 'M0 2H2V0H3V2H5V3H3V5H2V3H0Z';
function decal(paint: ReturnType<typeof seriesPaint>) {
  if (paint.pattern === 'solid') return null;
  const vertical = paint.pattern === 'vertical', dots = paint.pattern === 'dots', cross = paint.pattern === 'cross';
  return {
    symbol: dots ? 'circle' : cross ? `path://${crossPath}` : 'rect', symbolSize: 1,
    // ECharts materialises these defaults in getOption(). Include them so the
    // finished-event reconciliation converges after the first paint.
    symbolKeepAspect: true, maxTileWidth: 512, maxTileHeight: 512,
    color: patternInk(paint.color), backgroundColor: 'transparent',
    dashArrayX: cross ? [5, 1] : dots ? [2, 4] : vertical ? [1, 5] : [1, 0],
    dashArrayY: cross ? [5, 1] : dots ? [2, 4] : vertical ? [1, 0] : [1, 5],
    rotation: paint.pattern === 'diagonal' ? -Math.PI / 4 : paint.pattern === 'reverse-diagonal' ? Math.PI / 4 : 0,
  };
}

function presentation(state: ChartState, option: Options) {
  const style = getComputedStyle(state.host);
  const dark = chartContext(style).mode === 'dark';
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
    const paint = seriesPaint(state, series, index);
    set([...path, 'color'], paint.color);
    for (const statePath of [[], ['emphasis'], ['blur'], ['select']]) {
      set([...path, ...statePath, 'itemStyle', 'color'], paint.color);
      set([...path, ...statePath, 'itemStyle', 'opacity'], 1);
    }
    set([...path, 'emphasis', 'focus'], 'none');
    if (series.type === 'line') {
      for (const statePath of [[], ['emphasis'], ['blur'], ['select']]) {
        set([...path, ...statePath, 'lineStyle', 'width'], ENERGY_CHART_SPEC.lineWidth);
        set([...path, ...statePath, 'lineStyle', 'color'], paint.color);
        set([...path, ...statePath, 'lineStyle', 'opacity'], 1);
        set([...path, ...statePath, 'lineStyle', 'type'], paint.dash.length ? paint.dash : 'solid');
      }
      set([...path, 'lineStyle', 'cap'], 'round');
      set([...path, 'emphasis', 'scale'], false);
      set([...path, 'symbol'], paint.symbol);
      set([...path, 'symbolSize'], 6);
      set([...path, 'showSymbol'], array(series.data).filter(point => Number.isFinite((Array.isArray(point) ? point : point?.value)?.[1])).length === 1);
      if (paint.power) {
        // ECharts 6.1's nonanimated LineView update does not stop a native
        // transition already in flight. Its zero-duration update path does:
        // finish immediately, so an old animation cannot redraw split-sign
        // geometry after the signed projection has replaced the data.
        set([...path, 'animation'], true);
        set([...path, 'animationDuration'], 0);
        set([...path, 'animationDurationUpdate'], 0);
        // HA supplies individual source values and only stacks their display.
        // Remove cumulative stacking; applyPowerProjection combines only the
        // verified split-sign display pairs, retaining HA's native source.
        set([...path, 'stack'], null);
        set([...path, 'areaStyle'], null);
        set([...path, 'smooth'], false);
        for (const statePath of [['emphasis'], ['blur'], ['select']]) set([...path, ...statePath, 'areaStyle'], null);
      }
    } else if (series.type === 'bar') {
      for (const statePath of [[], ['emphasis'], ['blur'], ['select']]) {
        set([...path, ...statePath, 'itemStyle', 'borderRadius'], 0);
        set([...path, ...statePath, 'itemStyle', 'borderWidth'], 0);
        set([...path, ...statePath, 'itemStyle', 'borderColor'], paint.color);
        set([...path, ...statePath, 'itemStyle', 'decal'], decal(paint));
      }
      set([...path, 'barMaxWidth'], narrow ? 55 : 75);
      set([...path, 'barCategoryGap'], array(series.data).length >= (narrow ? 10 : 20) ? '20%' : '40%');
    }
    array(series.data).forEach((point, pointIndex) => {
      if (!point || typeof point !== 'object' || Array.isArray(point)) return;
      const pointPaint = state.card.localName === 'hui-energy-devices-graph-card' ? seriesPaint(state, series, index, point) : paint;
      const atPoint = [...path, 'data', pointIndex];
      for (const statePath of [[], ['emphasis'], ['blur'], ['select']]) {
        set([...atPoint, ...statePath, 'itemStyle', 'color'], pointPaint.color);
        set([...atPoint, ...statePath, 'itemStyle', 'opacity'], 1);
        set([...atPoint, ...statePath, 'itemStyle', 'borderColor'], pointPaint.color);
        if (series.type === 'bar') {
          set([...atPoint, ...statePath, 'itemStyle', 'borderRadius'], 0);
          set([...atPoint, ...statePath, 'itemStyle', 'borderWidth'], 0);
          set([...atPoint, ...statePath, 'itemStyle', 'decal'], decal(pointPaint));
        }
      }
    });
  });
  return changes;
}

const pointValues = (point: any) => Array.isArray(point) ? point : point?.value;
const sameReadings = (one: any, two: any) => Array.isArray(one) && Array.isArray(two)
  && one.length === two.length && one.every((point, index) => equal(pointValues(point), pointValues(two[index])));
const readingSnapshot = (data: any[]) => data.map(point => [...pointValues(point)]);

function restorePowerProjection(state: ChartState, option: Options, patch: Options, id: string, record: PowerProjection) {
  const indices = [id, `${id}-negative`].map(key => array(option.series).findIndex(series => series.id === key));
  if (indices.some(index => index < 0) || !indices.every((index, n) => sameReadings(option.series[index].data, record.applied[n]))) return;
  // Source arrays are HA's current period, never a saved previous-period
  // snapshot. Hidden or natively replaced data is no longer ours to restore.
  const latest = [id, `${id}-negative`].map(key => state.host.data?.find(series => series.id === key));
  if (latest.some(series => !Array.isArray(series?.data))) return;
  // If HA has published the next source before rendering its axes, wait for
  // that native render. Installing new readings under old axes is incorrect.
  if (latest.some((series, n) => series!.data !== record.source[n] || !sameReadings(series!.data, record.readings[n]))) return;
  indices.forEach((index, n) => writePatch(patch, option, ['series', index, 'data'], latest[n]!.data));
}

function applyPowerProjection(state: ChartState, option: Options, patch: Options) {
  if (state.card.localName !== 'hui-power-sources-graph-card') return false;
  const native = state.host.data || [], projected = projectPowerSeries(native);
  // Keep the table on the currently rendered period too. Source publication
  // can precede HA's plot/axes update; visibility alone is not a data source.
  for (const [id, record] of state.power) {
    const ids = [id, `${id}-negative`];
    const rendered = ids.map(key => array(option.series).find(series => series.id === key)?.data);
    const latest = ids.map(key => native.find(series => series.id === key)?.data);
    if (rendered.every((data, n) => sameReadings(data, record.applied[n]))
      && latest.some((data, n) => data !== record.source[n] || !sameReadings(data, record.readings[n]))) return true;
  }
  const seen = new Set<string>();
  for (const id of ['grid', 'battery']) {
    const sourceIndices = [id, `${id}-negative`].map(key => native.findIndex(series => series.id === key));
    if (sourceIndices.some(index => index < 0) || sourceIndices.some(index => projected[index] === native[index])) continue;
    const indices = [id, `${id}-negative`].map(key => array(option.series).findIndex(series => series.id === key));
    if (indices.some(index => index < 0)) continue;
    const source = sourceIndices.map(index => native[index].data), desired = sourceIndices.map(index => projected[index].data!);
    const previous = state.power.get(id);
    const nativeVisible = indices.every((index, n) => sameReadings(option.series[index].data, source[n]));
    const stillOwned = previous && indices.every((index, n) => sameReadings(option.series[index].data, previous.applied[n]));
    if (!nativeVisible && !(stillOwned && source.every((data, n) => data === previous!.source[n]))) {
      // HA may be between publishing new source values and rendering them.
      // Do not resurrect a hidden line or install a new date ahead of HA.
      if (stillOwned) seen.add(id);
      continue;
    }
    indices.forEach((index, n) => {
      if (sameReadings(option.series[index].data, desired[n])) return;
      const current = patch.series?.[index]?.data || option.series[index].data;
      const data = desired[n].map((point: any, pointIndex: number) => {
        const value = pointValues(point), styled = current[pointIndex];
        if (equal(pointValues(styled), value)) return styled;
        return Array.isArray(styled) ? [...value] : { ...styled, value: [...value] };
      });
      writePatch(patch, option, ['series', index, 'data'], data);
    });
    state.power.set(id, { source, readings: source.map(readingSnapshot), applied: desired.map(readingSnapshot) }); seen.add(id);
  }
  for (const [id, record] of state.power) if (!seen.has(id)) {
    restorePowerProjection(state, option, patch, id, record); state.power.delete(id);
  }
  return false;
}

function restore(state: ChartState) {
  if (!state.chart || state.chart.isDisposed?.()) { state.owned.clear(); state.power.clear(); return; }
  const option = state.chart.getOption();
  const patch: Options = {};
  for (const [key, record] of state.owned) {
    if (keyFor(record.path, option) !== key || !equal(at(option, record.path), record.applied)) continue;
    // null returns an absent inherited presentation field to its native
    // fallback; an undefined merge would leave our previous value installed.
    writePatch(patch, option, record.path, record.original === undefined ? null : record.original);
  }
  for (const [id, record] of state.power) restorePowerProjection(state, option, patch, id, record);
  state.power.clear();
  state.owned.clear();
  if (Object.keys(patch).length) state.chart.setOption(patch, { silent: true });
}

function detachChart(state: ChartState, reset: boolean) {
  // HA may dispose/recreate its renderer between an event and this microtask.
  // An internal API race must never break the native panel or companion.
  try { state.chart?.off('finished', state.finished); } catch { /* Already disposed. */ }
  if (reset) { try { restore(state); } catch { /* Native renderer no longer accepts options. */ } }
  state.owned.clear();
  state.power.clear();
  state.chart = undefined;
}

function cardTitle(card: HTMLElement) {
  const native = card.shadowRoot?.querySelector<HTMLElement & { header?: string }>('ha-card');
  const heading = card.shadowRoot?.querySelector('.card-header') || native?.shadowRoot?.querySelector('.card-header');
  // A header can also contain the changing total chip; use its title span.
  return (heading?.querySelector(':scope > span') || heading)?.textContent?.trim()
    || native?.header?.trim() || native?.getAttribute('header')?.trim() || '';
}

let markerId = 0;
function svgNode(name: string, attributes: Record<string, string | number> = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function drawKey(marker: SVGSVGElement, paint: ReturnType<typeof seriesPaint>, line: boolean, singlePoint: boolean) {
  marker.replaceChildren();
  if (line) {
    marker.append(svgNode('line', { x1: 2, y1: 8, x2: 22, y2: 8, stroke: paint.color, 'stroke-width': ENERGY_CHART_SPEC.lineWidth, 'stroke-linecap': 'round', 'stroke-dasharray': paint.dash.join(' ') }));
    if (singlePoint) {
      const empty = paint.symbol.startsWith('empty');
      const symbol = empty ? paint.symbol.slice(5).toLowerCase() : paint.symbol;
      // ECharts' empty symbols use neutral00 (white) for the interior.
      const attributes = { fill: empty ? '#FFFFFF' : paint.color, stroke: paint.color, 'stroke-width': empty ? 1.5 : 0 };
      marker.append(symbol === 'rect' || symbol === 'roundRect'
        ? svgNode('rect', { x: 9, y: 5, width: 6, height: 6, rx: symbol === 'roundRect' ? 1.5 : 0, ...attributes })
        : symbol === 'triangle' || symbol === 'diamond'
          ? svgNode('path', { d: symbol === 'triangle' ? 'M12 4L16 11H8Z' : 'M12 4L16 8L12 12L8 8Z', ...attributes })
          : svgNode('circle', { cx: 12, cy: 8, r: 3, ...attributes }));
    }
    return;
  }
  marker.append(svgNode('circle', { cx: 12, cy: 8, r: 6, fill: paint.color }));
  if (paint.pattern === 'solid') return;
  const id = `civica-chart-pattern-${++markerId}`;
  const defs = svgNode('defs');
  const rotation = paint.pattern === 'diagonal' ? -45 : paint.pattern === 'reverse-diagonal' ? 45 : 0;
  const pattern = svgNode('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rotation})` });
  pattern.append(paint.pattern === 'dots'
    ? svgNode('circle', { cx: 1, cy: 1, r: 1, fill: patternInk(paint.color) })
    : paint.pattern === 'cross' ? svgNode('path', { d: crossPath, fill: patternInk(paint.color) })
      : svgNode('path', { d: paint.pattern === 'vertical' ? 'M.5 0V6' : 'M0 .5H6', stroke: patternInk(paint.color), 'stroke-width': 1 }));
  defs.append(pattern); marker.append(defs, svgNode('circle', { cx: 12, cy: 8, r: 6, fill: `url(#${id})` }));
}

function updateLegend(state: ChartState, option: Options) {
  const seen = new Set<HTMLElement>();
  const rendered = array(option.series);
  for (const button of state.host.shadowRoot?.querySelectorAll<HTMLElement>('.chart-legend .legend-toggle[data-id]') || []) {
    const id = button.dataset.id!;
    let index = state.host.data?.findIndex(series => String(series.id ?? series.name) === id) ?? -1;
    let point: Options | undefined;
    if (index < 0) index = state.host.data?.findIndex(series => {
      point = array(series.data).find(value => value && !Array.isArray(value) && String(value.id ?? value.name) === id);
      return !!point;
    }) ?? -1;
    if (index < 0) continue;
    const source = state.host.data?.[index];
    const renderedIndex = source?.id === undefined ? index : rendered.findIndex(series => series.id === source.id);
    if (renderedIndex < 0 || !rendered[renderedIndex]) continue;
    const current = rendered[renderedIndex];
    const paint = seriesPaint(state, current, renderedIndex, point);
    const line = current.type === 'line';
    const singlePoint = line && array(current.data).filter(value => Number.isFinite((Array.isArray(value) ? value : value?.value)?.[1])).length === 1;
    const signature = JSON.stringify([paint.color, paint.pattern, paint.dash, paint.symbol, paint.total, paint.forecast, line, singlePoint]);
    let owned = state.keys.get(button);
    if (!owned) {
      const marker = svgNode('svg', { viewBox: '0 0 24 16', 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement;
      marker.classList.add('civica-chart-key');
      owned = { marker, signature: '' }; state.keys.set(button, owned); button.append(marker);
    }
    if (owned.marker.parentElement !== button) button.append(owned.marker);
    if (owned.signature !== signature) { drawKey(owned.marker, paint, line, singlePoint); owned.signature = signature; }
    button.dataset.civicaKey = line ? 'line' : 'bar';
    seen.add(button);
  }
  for (const [button, owned] of state.keys) if (!seen.has(button)) { owned.marker.remove(); delete button.dataset.civicaKey; state.keys.delete(button); }
}

function restoreDom(state: ChartState) {
  for (const [button, owned] of state.keys) { owned.marker.remove(); delete button.dataset.civicaKey; }
  state.keys.clear();
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
  updateLegend(state, option);
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
  const pendingPower = applyPowerProjection(state, option, patch);
  if (Object.keys(patch).length) chart.setOption(patch, { silent: true });
  state.host.dataset.civicaEnergyChart = ENERGY_CHART_SPEC.frontend;
  delete state.host.dataset.civicaEnergyError;
  if (!pendingPower) updateEnergyChartData(state.host, {
    title: title || 'Energy chart', locale: context.locale?.language, timeZone: context.config?.time_zone,
    numberFormat: context.locale?.number_format, timeFormat: context.locale?.time_format,
    timeZonePreference: context.locale?.time_zone,
    series: state.card.localName === 'hui-power-sources-graph-card' ? projectPowerSeries(state.host.data || []) : undefined,
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
          const next = { host, card: owner, panel, owned: new Map(), keys: new Map(), power: new Map(), queued: false, stopped: false } as ChartState;
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
