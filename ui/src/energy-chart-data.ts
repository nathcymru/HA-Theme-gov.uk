/** Accessible, read-only views of values already supplied to native HA charts. */
export interface EnergyChartDataHost extends HTMLElement {
  data?: unknown;
  options?: unknown;
  sonificationLabelFormatter?: (label: string) => string | undefined;
}
export interface EnergyChartDataContext {
  title: string; locale?: string; timeZone?: string;
  numberFormat?: string; timeFormat?: string; timeZonePreference?: string;
  /** Verified display projection; source host.data remains unchanged. */
  series?: unknown;
}
interface Row { series: string; period?: number; category?: string; value: number | null; unit: string }
interface Model { rows: Row[]; unsupported: boolean; time: boolean; category: boolean; periodStart: boolean; chartTime: boolean }
interface State {
  section: HTMLElement; details: HTMLDetailsElement; caption: HTMLTableCaptionElement;
  scope: HTMLElement; message: HTMLElement; table: HTMLTableElement; body: HTMLTableSectionElement;
  status: HTMLElement; previous: HTMLButtonElement; next: HTMLButtonElement;
  host: EnergyChartDataHost; context: EnergyChartDataContext; page: number; signature: string; projectionModel?: Model;
}
const states = new WeakMap<EnergyChartDataHost, State>();
const PAGE_SIZE = 100;
const object = (value: unknown): Record<string, any> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;
const array = (value: unknown): any[] => Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const timestamp = (value: unknown): value is number => numeric(value) && !Number.isNaN(new Date(value).getTime());
const axis = (options: Record<string, any>, name: string, index?: number) => object(array(options[name])[index ?? 0]) ?? {};

/** Only established native shapes are recognised. Never infer absent samples. */
function readModel(host: EnergyChartDataHost, suppliedSeries: unknown = host.data): Model {
  const model: Model = { rows: [], unsupported: false, time: false, category: false, periodStart: false, chartTime: false };
  const options = object(host.options) ?? {};
  const legendItems = array(options.legend).flatMap(legend => array(object(legend)?.data));
  for (const [index, rawSeries] of array(suppliedSeries).entries()) {
    const series = object(rawSeries);
    if (!series || !Array.isArray(series.data)) { model.unsupported = true; continue; }
    if (!series.data.length) continue;
    if (!['line', 'bar'].includes(series.type)) { model.unsupported = true; continue; }
    const x = axis(options, 'xAxis', series.xAxisIndex), y = axis(options, 'yAxis', series.yAxisIndex);
    const time = x.type === 'time';
    const category = x.type === 'value' && y.type === 'category';
    if (!time && !category) { model.unsupported = true; continue; }
    model.time ||= time; model.category ||= category;
    const comparison = string(series.id).startsWith('compare-');
    const name = string(series.name) || string(series.id) || `Series ${index + 1}`;
    const label = comparison ? `${name} (comparison)` : name;
    const unit = string((time ? y : x).name).trim();
    for (const rawPoint of series.data) {
      const point = object(rawPoint);
      const values = Array.isArray(rawPoint) ? rawPoint : point?.value;
      if (!Array.isArray(values)) { model.unsupported = true; continue; }
      if (time) {
        // Native comparisons shift displayX onto the current date. The third
        // value retains the actual source period; native tooltips use it too.
        const period = timestamp(values[2]) ? values[2] : values[0];
        if (!timestamp(period)) { model.unsupported = true; continue; }
        model.periodStart ||= timestamp(values[2]); model.chartTime ||= !timestamp(values[2]);
        model.rows.push({ series: label, period, value: numeric(values[1]) ? values[1] : null, unit });
      } else {
        const key = string(values[1]) || string(point?.name);
        if (!key) { model.unsupported = true; continue; }
        let device = '';
        try { device = string(host.sonificationLabelFormatter?.(key)); } catch { /* Keep native label available. */ }
        if (!device) {
          const legend = legendItems.find(item => object(item)?.id === key || object(item)?.name === key);
          device = string(object(legend)?.name) || string(point?.name) || key;
        }
        model.rows.push({ series: label, category: device, value: numeric(values[0]) ? values[0] : null, unit });
      }
    }
  }
  return model;
}

const CSS = `
:host { display: block; min-width: 0; margin-top: 20px; color: var(--primary-text-color); font: var(--civica-font-size-small, 16px)/1.5 var(--ha-font-family-body, Arial, sans-serif); }
* { box-sizing: border-box; }
summary { width: fit-content; max-width: 100%; min-height: 44px; padding-block: 10px; color: var(--link-color); cursor: pointer; list-style: none; text-decoration: underline; text-underline-offset: .16em; }
summary::-webkit-details-marker { display: none; }
summary::before { content: ''; display: inline-block; width: 12px; height: 14px; margin-inline-end: 10px; background: currentColor; clip-path: polygon(0 0, 100% 50%, 0 100%); vertical-align: middle; }
details[open] > summary::before { clip-path: polygon(0 10%, 100% 10%, 50% 90%); }
summary:focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); box-shadow: 0 -2px 0 var(--ha-color-focus), 0 4px 0 var(--civica-focus-text, var(--black-color)); text-decoration: none; }
p { margin: 10px 0 15px; }
.table-region { max-width: 100%; max-height: min(60vh, 480px); overflow: auto; }
.table-region:focus-visible { outline: 3px solid var(--ha-color-focus); outline-offset: 2px; }
table { width: 100%; min-width: 520px; border-collapse: collapse; font: inherit; }
caption { padding-block: 10px; text-align: start; font-weight: 700; }
th, td { padding: 10px 15px 10px 0; border-bottom: 1px solid var(--divider-color); vertical-align: top; text-align: start; overflow-wrap: anywhere; }
thead th { font-weight: 700; }
.number { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 15px; margin-top: 15px; }
.pagination p { margin: 0; }
button { min-width: 44px; min-height: 44px; padding: 8px 10px 7px; border: 2px solid transparent; border-radius: 0; color: var(--primary-text-color); background: var(--secondary-background-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); font: inherit; cursor: pointer; }
button:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
button:disabled { opacity: .5; cursor: default; }
button:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
[hidden] { display: none; }
@media (forced-colors: active) { button { border-color: ButtonText; } summary:focus-visible, button:focus-visible, .table-region:focus-visible { outline: 3px solid Highlight; } }
`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;
}
function formats(context: EnergyChartDataContext) {
  let locale: string;
  try { locale = new Intl.NumberFormat(context.locale || 'en-GB').resolvedOptions().locale; } catch { locale = 'en-GB'; }
  // These preference mappings follow HA's numberFormatToLocale, useAmPm and
  // resolveTimeZone helpers. Written month dates follow the selected language;
  // numeric-only date-order preferences do not apply to this table format.
  const numberLocales: Record<string, string[] | undefined> = {
    comma_decimal: ['en-US', 'en'], decimal_comma: ['de', 'es', 'it'],
    space_comma: ['fr', 'sv', 'cs'], quote_decimal: ['de-CH'], none: ['en-US'], system: undefined,
  };
  const numberLocale = context.numberFormat && context.numberFormat in numberLocales ? numberLocales[context.numberFormat] : locale;
  const nativeZone = (globalThis as typeof globalThis & { __haNativeTimeZone?: string }).__haNativeTimeZone;
  const localZone = [nativeZone, Intl.DateTimeFormat().resolvedOptions().timeZone].find(zone => {
    if (!zone || /^[+-]/.test(zone)) return false;
    try { new Intl.DateTimeFormat(locale, { timeZone: zone }); return true; } catch { return false; }
  });
  let timeZone = (context.timeZonePreference === 'local' && localZone ? localZone : context.timeZone || localZone) || 'UTC';
  try { new Intl.DateTimeFormat(locale, { timeZone }); } catch { timeZone = 'UTC'; }
  const hour12 = context.timeFormat === '12' || (context.timeFormat !== '24' && new Intl.DateTimeFormat(context.timeFormat === 'system' ? undefined : locale, { hour: 'numeric' }).resolvedOptions().hour12);
  return {
    number: new Intl.NumberFormat(numberLocale, { maximumSignificantDigits: 15, ...(context.numberFormat === 'none' ? { useGrouping: false } : {}) }), timeZone,
    date: new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hourCycle: hour12 ? 'h12' : 'h23', timeZoneName: 'shortOffset' }),
  };
}
function render(state: State, force = false) {
  const model = state.projectionModel ?? readModel(state.host);
  const signature = JSON.stringify([{ ...state.context, series: undefined }, model]);
  if (!force && signature === state.signature) return;
  const changed = signature !== state.signature;
  state.signature = signature;
  if (changed) state.page = 0;
  const { number, date, timeZone } = formats(state.context);
  state.caption.textContent = `${state.context.title} — chart values`;
  state.scope.textContent = `Values supplied to this chart for the selected period, including series hidden with the legend. Zoom does not change this table.${model.time ? ` Times are shown in ${timeZone}. Where a period start is supplied, that original time is shown.` : ''} Missing values are shown as “Not available”. This is not a record of every meter reading.`;
  state.message.textContent = model.unsupported
    ? 'Some series use a format this table cannot display. Use the native chart and its controls for those series.'
    : model.rows.length ? '' : 'No chart values are available for the selected period.';
  state.message.hidden = !state.message.textContent;
  state.table.hidden = model.rows.length === 0;
  state.table.parentElement!.hidden = model.rows.length === 0;
  const headers = state.table.tHead!.rows[0];
  headers.cells[1].textContent = model.time && model.category ? 'Time or device' : model.category ? 'Device' : model.periodStart && model.chartTime ? 'Time or period start' : model.periodStart ? 'Period start' : 'Time';
  state.body.replaceChildren();
  const start = state.page * PAGE_SIZE;
  for (const row of model.rows.slice(start, start + PAGE_SIZE)) {
    const tr = element('tr');
    const name = element('th', row.series); name.scope = 'row';
    const location = element('td', row.period === undefined ? row.category : date.format(row.period));
    const value = element('td', row.value === null ? 'Not available' : number.format(row.value)); value.className = 'number';
    tr.append(name, location, value, element('td', row.unit || 'Not supplied'));
    state.body.append(tr);
  }
  const end = Math.min(start + PAGE_SIZE, model.rows.length);
  state.status.textContent = model.rows.length ? `Rows ${number.format(start + 1)} to ${number.format(end)} of ${number.format(model.rows.length)}` : '';
  state.previous.disabled = state.page === 0;
  state.next.disabled = end >= model.rows.length;
  state.previous.hidden = state.next.hidden = model.rows.length <= PAGE_SIZE;
}

export function updateEnergyChartData(host: EnergyChartDataHost, context: EnergyChartDataContext): void {
  if (!host.parentNode) return;
  let state = states.get(host);
  if (!state) {
    const section = element('section'); section.className = 'civica-energy-data'; section.dataset.civicaEnergyData = '';
    const root = section.attachShadow({ mode: 'open' });
    const style = element('style', CSS);
    const details = element('details'), summary = element('summary', 'View data');
    const scope = element('p'), message = element('p');
    const region = element('div'); region.className = 'table-region'; region.tabIndex = 0; region.setAttribute('role', 'region');
    const table = element('table'), caption = element('caption'); table.append(caption);
    const headers = table.createTHead().insertRow();
    for (const title of ['Series', 'Period start', 'Value', 'Unit']) { const th = element('th', title); th.scope = 'col'; headers.append(th); }
    headers.cells[2].className = 'number';
    const body = table.createTBody(); region.append(table);
    const pagination = element('div'); pagination.className = 'pagination';
    const previous = element('button', 'Previous rows'), next = element('button', 'Next rows'); previous.type = next.type = 'button';
    const status = element('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    pagination.append(previous, status, next); details.append(summary, scope, message, region, pagination); root.append(style, details);
    state = { section, details, caption, scope, message, table, body, status, previous, next, host, context, page: 0, signature: '' };
    const entry = state;
    details.addEventListener('toggle', () => { if (details.open) render(entry, true); });
    previous.addEventListener('click', () => { if (entry.page > 0) { entry.page--; render(entry, true); } });
    next.addEventListener('click', () => { if (!next.disabled) { entry.page++; render(entry, true); } });
    states.set(host, state);
  }
  state.context = context;
  // Capture scalar rows while the adapter and native renderer agree. The
  // source can mutate in place before its next render, even with details shut.
  // Building the table DOM remains deferred until the disclosure opens.
  state.projectionModel = context.series === undefined ? undefined : readModel(host, context.series);
  const summary = state.details.querySelector('summary')!;
  summary.setAttribute('aria-label', `View data for ${context.title}`);
  state.section.shadowRoot!.querySelector('.table-region')!.setAttribute('aria-label', `${context.title} data table — scroll to see all columns`);
  if (state.section.previousSibling !== host) host.after(state.section);
  if (state.details.open) render(state);
}

export function removeEnergyChartData(host: EnergyChartDataHost): void {
  states.get(host)?.section.remove(); states.delete(host);
}
