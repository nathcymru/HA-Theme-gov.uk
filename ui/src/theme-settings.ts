import palettes from '../../design-system/palettes.json';

export interface ThemeHass {
  config?: { safe_mode?: boolean; recovery_mode?: boolean; time_zone?: string };
  locale?: { language?: string; time_format?: string; number_format?: string; time_zone?: string };
  themes: { themes: Record<string, unknown>; theme?: string; darkMode?: boolean; default_theme?: string };
  selectedTheme?: { theme?: string; dark?: boolean; primaryColor?: string; accentColor?: string };
}

export const themeName = (name: string, muted: boolean) => `civica ${name} ${muted ? 'Muted' : 'Vivid'}`;
export function selectedVariant(hass?: ThemeHass) {
  const name = hass?.themes.theme || hass?.selectedTheme?.theme || hass?.themes.default_theme;
  for (const palette of palettes.palettes) {
    for (const muted of [false, true]) {
      if (name === themeName(palette.name, muted)) return { palette, muted };
    }
  }
  return name === 'govuk' ? { palette: palettes.palettes[0], muted: false } : undefined;
}

const CSS = `
:host { display:block; font-family:var(--ha-font-family-body, Arial, sans-serif); font-size:var(--civica-font-size-body, 19px); line-height:1.5; color:var(--primary-text-color, #0b0c0c); }
* { box-sizing:border-box; }
section { margin:20px 0; padding:20px 0 0; border-top:1px solid var(--civica-border-quiet, #cecece); background:var(--card-background-color, white); }
h2 { margin:0 0 16px; font-size:var(--civica-font-size-heading, 24px); line-height:1.25; }
p { max-width:65ch; line-height:1.5; margin:12px 0; }
label { display:block; font-weight:700; margin-bottom:8px; }
select { font:inherit; color:inherit; background:var(--input-fill-color, white); border:2px solid var(--primary-text-color, #0b0c0c); border-radius:0; min-height:44px; width:100%; max-width:28rem; padding:6px; }
.tone { display:flex; gap:12px; align-items:center; margin-top:20px; min-height:44px; cursor:pointer; }
input { width:24px; height:24px; flex:none; accent-color:var(--primary-color, #1d70b8); }
select:focus-visible, input:focus-visible { outline:3px solid #ffdd00; outline-offset:2px; box-shadow:0 0 0 5px #0b0c0c; }
.hint { font-size:var(--civica-font-size-small, 16px); color:var(--secondary-text-color, #484949); }
[role=status] { font-size:var(--civica-font-size-small, 16px); min-height:1.5em; }
@media(forced-colors:active) { select:focus-visible, input:focus-visible { outline-color:Highlight; box-shadow:none; } }
`;

export class CivicaThemeSettings extends HTMLElement {
  private current?: ThemeHass;
  private timer?: ReturnType<typeof setInterval>;
  private select!: HTMLSelectElement;
  private muted!: HTMLInputElement;
  private status!: HTMLParagraphElement;
  private stateKey = '';
  public getCardSize() { return 4; }
  public setConfig(_config: unknown) { /* No entities or server-wide helpers required. */ }
  public set hass(value: ThemeHass) { this.current = value; this.sync(); }
  public get hass() { return this.current!; }
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = CSS;
    const section = document.createElement('section'); section.setAttribute('aria-labelledby', 'title');
    const title = document.createElement('h2'); title.id = 'title'; title.textContent = 'civica.uk colours';
    const label = document.createElement('label'); label.htmlFor = 'palette'; label.textContent = 'Colour palette';
    this.select = document.createElement('select'); this.select.id = 'palette'; this.select.setAttribute('aria-describedby', 'hint');
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a civica.uk palette'; placeholder.disabled = true; this.select.append(placeholder);
    for (const p of palettes.palettes) { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; this.select.append(option); }
    const toggle = document.createElement('label'); toggle.className = 'tone'; toggle.htmlFor = 'muted';
    this.muted = document.createElement('input'); this.muted.type = 'checkbox'; this.muted.id = 'muted'; this.muted.setAttribute('role', 'switch'); this.muted.setAttribute('aria-describedby', 'hint');
    const text = document.createElement('span'); text.textContent = 'Use muted colours'; toggle.append(this.muted, text);
    const hint = document.createElement('p'); hint.id = 'hint'; hint.className = 'hint'; hint.textContent = 'Use softer brand and chart colours, or switch off for vivid colours. Your light, dark or automatic mode stays the same.';
    this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    section.append(title, label, this.select, toggle, hint, this.status); root.append(style, section);
    this.select.addEventListener('change', () => this.apply()); this.muted.addEventListener('change', () => this.apply());
    this.sync();
  }
  connectedCallback() {
    clearInterval(this.timer);
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 750);
  }
  disconnectedCallback() { clearInterval(this.timer); }
  private refresh() {
    const app = document.querySelector('home-assistant') as (HTMLElement & { hass?: ThemeHass }) | null;
    if (app?.hass) this.hass = app.hass;
  }
  private sync() {
    if (!this.select) return;
    const available = this.current?.themes.themes || {};
    const variant = selectedVariant(this.current);
    const recovery = this.current?.config?.safe_mode || this.current?.config?.recovery_mode;
    const key = `${recovery}|${this.current?.selectedTheme?.theme}|${this.current?.themes.theme}|${Object.keys(available).join('|')}`;
    if (this.stateKey === key) return;
    this.stateKey = key;
    const hasAll = palettes.palettes.every(p => [false, true].every(m => themeName(p.name, m) in available));
    this.select.disabled = !hasAll || Boolean(recovery);
    this.muted.disabled = !hasAll || !variant || Boolean(recovery);
    this.select.value = variant?.palette.id || ''; this.muted.checked = variant?.muted || false;
    this.status.textContent = recovery ? 'Colour controls are unavailable in safe or recovery mode.' : !hasAll ? 'Install all civica.uk themes and reload themes to use these controls.' : variant ? `${variant.palette.name}: ${variant.muted ? 'muted' : 'vivid'} colours selected.` : 'Choose a palette to use civica.uk colours.';
  }
  private apply() {
    const palette = palettes.palettes.find(p => p.id === this.select.value);
    if (!palette || this.current?.config?.safe_mode || this.current?.config?.recovery_mode) return;
    const theme = themeName(palette.name, this.muted.checked);
    if (!this.current?.themes.themes[theme]) { this.status.textContent = 'This theme is unavailable. Reload themes and try again.'; return; }
    // This is the same event used by HA's own profile theme row. HA owns local
    // application, persistence, cross-device updates and any save-failure toast.
    // Clear native colour overrides so they cannot partially mask this palette.
    this.dispatchEvent(new CustomEvent('settheme', {
      detail: { theme, primaryColor: undefined, accentColor: undefined }, bubbles: true, composed: true,
    }));
    this.status.textContent = `${palette.name}: ${this.muted.checked ? 'muted' : 'vivid'} colours selected.`;
  }
}

if (!customElements.get('civica-theme-settings')) customElements.define('civica-theme-settings', CivicaThemeSettings);
const registry = window as unknown as { customCards?: object[] };
registry.customCards ||= [];
if (!registry.customCards.some((c: any) => c.type === 'civica-theme-settings')) registry.customCards.push({ type: 'civica-theme-settings', name: 'civica.uk colours', description: 'Choose a colour palette and switch between vivid and muted colours.' });
