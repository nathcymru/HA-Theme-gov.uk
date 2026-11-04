import { assessRoom } from '../../lighting/engine/capabilities.ts';
import { buildPlan } from '../../lighting/engine/plan.ts';
import type { Snapshot, RoomSource, RoomLightingCapabilities } from '../../lighting/engine/types.ts';
import RECIPES from '../../lighting/generated/recipes.json' with { type: 'json' };
import FLOOR from './rooms.json' with { type: 'json' };
import { STYLES } from './styles.ts';

const SVG = 'http://www.w3.org/2000/svg';
const RECIPE_LIST = RECIPES as any[];
// Two tabs: whites and solid colours share one grid; scenes have their own.
const CATS: Array<[string, string, string[]]> = [['light', 'Whites and colours', ['white', 'color']], ['scene', 'Scenes', ['scene']]];
const COG = 'M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.86,17.38L11.25,20H12.75L13.12,17.4C14.32,17.14 15.38,16.5 16.15,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.38C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z';
const REASONS: Record<string, string> = {
  no_lights: 'This room has no lights this card can control.', all_unavailable: 'All lights in this room are unavailable.',
  members_unavailable: 'Some lights are unavailable, so the whole room cannot be set to one colour.',
  needs_all_colour: 'Every light in this room must be able to show colour.', needs_colour_light: 'This room needs at least one colour light.',
  no_dimmable_lights: 'No light in this room can be dimmed.',
};
const SAFE_CSS = /^(#[0-9A-Fa-f]{6}|linear-gradient\(90deg(, #[0-9A-Fa-f]{6} \d{1,3}%)+\))$/;
const safeCss = (v: string) => (SAFE_CSS.test(v) ? v : 'transparent');
const previewOf = (r: any): string => safeCss(r.previewCss ?? r.preview);
const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Same pace as the floor-plan tint, so a scene tile and its room change colour together. */
const paletteSeconds = (n: number) => Math.max(4, n * 3);

function el(tag: string, props: Record<string, any> = {}, ...kids: Array<Node | string>): any {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : String(v));
  }
  e.append(...kids);
  return e;
}
const svg = (tag: string, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

interface RoomCfg extends RoomSource { }
interface Config { type: string; title?: string; rooms: RoomCfg[]; image?: string }
interface RoomView { cfg: RoomCfg; caps: RoomLightingCapabilities; sig: string; on: number; owner: string; row?: HTMLElement; poly?: SVGPolygonElement }

class GovukHouseLightingCard extends HTMLElement {
  private _hass: any; private config!: Config; private root: ShadowRoot; private views = new Map<string, RoomView>();
  private dialog?: HTMLDialogElement; private current?: string; private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private onMotion = () => this.paintAll();
  private status?: HTMLElement; private list?: HTMLElement; private plan?: SVGElement; private built = false;

  constructor() { super(); this.root = this.attachShadow({ mode: 'open' }); }

  static getStubConfig() { return { type: 'custom:govuk-house-lighting-card' }; }
  setConfig(config: Partial<Config>) {
    if (!config || config.type === undefined) throw new Error('govuk-house-lighting-card: "type" is required');
    const rooms = config.rooms ?? FLOOR.rooms;
    if (!Array.isArray(rooms) || !rooms.length) throw new Error('"rooms" must be a non-empty list');
    const ids = new Set<string>();
    for (const r of rooms as RoomCfg[]) {
      if (!r.id || !/^[a-z][a-z0-9_]*$/.test(r.id)) throw new Error(`room id "${r.id}" is invalid (lowercase letters, digits, underscore)`);
      if (ids.has(r.id)) throw new Error(`duplicate room id "${r.id}"`);
      ids.add(r.id);
      if (!r.area && !r.entities?.length) throw new Error(`room "${r.id}" needs an "area" or "entities"`);
      if (!(r.id in FLOOR.regions)) throw new Error(`room "${r.id}" has no floor-plan region (known: ${Object.keys(FLOOR.regions).join(', ')})`);
    }
    this.config = { ...config, rooms: rooms as RoomCfg[], title: config.title ?? 'House lighting' } as Config;
    this.built = false; this.views.clear(); if (this._hass) this.set_hass(this._hass);
  }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: 'auto' }; }

  set hass(h: any) { this.set_hass(h); }
  private set_hass(h: any) {
    this._hass = h;
    if (!this.config) return;
    if (!this.built) this.build();
    this.refresh();
  }
  connectedCallback() { this.reduceMotion.addEventListener('change', this.onMotion); }
  disconnectedCallback() { this.reduceMotion.removeEventListener('change', this.onMotion); this.dialog?.close(); }

  private snapshot(): Snapshot { const h = this._hass; return { entities: h.entities ?? {}, devices: h.devices ?? {}, states: h.states }; }

  private build() {
    this.built = true;
    const style = el('style'); style.textContent = STYLES;
    const title = el('h2', { class: 'title' }, this.config.title!);
    this.status = el('p', { class: 'status', role: 'status' });
    const all = el('div', { class: 'actions' },
      el('button', { class: 'btn', type: 'button', onclick: () => this.all(true) }, 'Turn all on'),
      el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => this.all(false) }, 'Turn all off'));
    this.list = el('dl', { class: 'rooms' });
    this.plan = this.buildPlan();
    this.root.replaceChildren(style, el('ha-card', {}, el('div', { class: 'body' }, title, this.status!, all, this.list!, this.plan!)));
    for (const cfg of this.config.rooms) this.views.set(cfg.id, { cfg, caps: undefined as any, sig: '', on: 0, owner: '' });
    for (const v of this.views.values()) this.list!.append(this.buildRow(v));
    this.dialog = this.buildDialog(); this.root.append(this.dialog);
  }

  private buildPlan(): SVGElement {
    const { width, height } = FLOOR.image;
    const s = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'plan', role: 'group', 'aria-label': 'Floor plan. Select a room to change its lighting.' });
    const base = this.config.image ?? new URL(`../${FLOOR.image.file}`, import.meta.url).href;
    const img = svg('image', { href: base, x: 0, y: 0, width, height }); s.append(img);
    for (const cfg of this.config.rooms) {
      const pts = (FLOOR.regions as any)[cfg.id].map((p: number[]) => p.join(',')).join(' ');
      s.append(svg('polygon', { points: pts, class: 'shade', 'data-room': cfg.id, 'pointer-events': 'none' }));
    }
    for (const cfg of this.config.rooms) {
      const pts = (FLOOR.regions as any)[cfg.id].map((p: number[]) => p.join(',')).join(' ');
      const hit = svg('polygon', { points: pts, class: 'hit', tabindex: 0, role: 'button', 'data-room': cfg.id });
      hit.addEventListener('click', () => this.open(cfg.id));
      hit.addEventListener('keydown', (e) => { const k = (e as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); this.open(cfg.id); } });
      s.append(hit);
    }
    return s;
  }

  private buildRow(v: RoomView): HTMLElement {
    const name = v.cfg.name ?? v.cfg.id;
    const toggle = el('button', { class: 'btn btn--small', type: 'button', onclick: () => this.toggle(v) });
    const icon = svg('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true', focusable: 'false' });
    icon.append(svg('path', { d: COG, fill: 'currentColor' }));
    const settings = el('button', { class: 'btn btn--secondary btn--icon', type: 'button', title: 'Settings', onclick: (e: Event) => this.open(v.cfg.id, e.currentTarget as HTMLElement) }, icon, el('span', { class: 'vh' }, `Settings for ${name}`));
    // Only a room that cannot be controlled gets a line under its name; normal state is shown by the button.
    const row = el('div', { class: 'row', 'data-room': v.cfg.id }, el('dt', { class: 'key' }, name, el('span', { class: 'sub', 'data-role': 'sub' })), el('dd', { class: 'act' }, toggle, settings));
    v.row = row; return row;
  }

  private buildDialog(): HTMLDialogElement {
    const d = el('dialog', { class: 'dlg', 'aria-labelledby': 'dlg-title' });
    d.addEventListener('close', () => { this.current = undefined; });
    return d;
  }

  private open(roomId: string, opener?: HTMLElement) {
    this.current = roomId;
    this.renderDialog();
    if (!this.dialog!.open) this.dialog!.showModal(); // native: focus trap, Esc, focus returns to opener
    void opener;
  }

  private renderDialog(tab = CATS[0][0]) {
    const v = this.views.get(this.current!)!, d = this.dialog!;
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const tabs = el('div', { role: 'tablist', class: 'tabs', 'aria-label': 'Lighting type' });
    const panels = el('div', { class: 'panels' });
    CATS.forEach(([cat, label, kinds]) => {
      const t = el('button', { role: 'tab', type: 'button', class: 'tab', id: `tab-${cat}`, 'aria-controls': `panel-${cat}`, 'aria-selected': String(cat === tab), tabindex: cat === tab ? 0 : -1,
        onclick: () => this.renderDialog(cat),
        onkeydown: (e: KeyboardEvent) => { const i = CATS.findIndex((c) => c[0] === cat); const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1; if (n >= 0) { e.preventDefault(); this.renderDialog(CATS[(n + CATS.length) % CATS.length][0]); this.dialog!.querySelector<HTMLElement>('[aria-selected=true]')!.focus(); } } }, label);
      tabs.append(t);
      const p = el('div', { role: 'tabpanel', id: `panel-${cat}`, 'aria-labelledby': `tab-${cat}`, hidden: cat !== tab });
      const grid = el('ul', { class: 'tiles' });
      let anyOff = false;
      for (const r of RECIPE_LIST.filter((x) => kinds.includes(x.category))) {
        const a = avail.get(r.id)!; const off = a.availability === 'unsupported'; anyOff = anyOff || off;
        // The name is a tooltip and the accessible name; tiles are a visual picker.
        const reason = off ? REASONS[a.reason ?? ''] ?? 'Not available in this room.' : '';
        const tip = reason ? `${r.label}: ${reason}` : r.label;
        const swatch = el('span', { class: 'swatch' });
        if (r.category === 'scene') this.animateSwatch(swatch, r, v); else swatch.style.background = previewOf(r);
        const kids: Node[] = [swatch];
        if (r.category === 'scene') kids.push(el('img', { class: 'tile-icon', src: new URL(`../assets/icons/${r.id}.svg`, import.meta.url).href, alt: '', loading: 'lazy' }));
        const btn = el('button', { class: 'tile', type: 'button', disabled: off, title: tip, 'aria-label': tip, 'aria-pressed': String(v.owner === r.id), onclick: () => this.pick(v, r) }, ...kids);
        grid.append(el('li', {}, btn));
      }
      p.append(grid);
      if (anyOff) p.append(el('p', { class: 'hint' }, 'Faded options cannot be used in this room. Hover over one to see why.'));
      panels.append(p);
    });
    d.replaceChildren(el('h3', { id: 'dlg-title', class: 'dlg-title' }, `${v.cfg.name ?? v.cfg.id} lighting`), tabs, panels,
      el('button', { class: 'btn btn--secondary dlg-close', type: 'button', onclick: () => d.close() }, 'Close'));
    // Confirm dialog for flashing scenes is created on demand in pick().
  }

  /** Cycles the room's effective scene palette at the same pace as the floor-plan tint. Static when motion is reduced. */
  private animateSwatch(swatch: HTMLElement, r: any, v: RoomView) {
    const palette = buildPlan(r, v.caps.lightCapabilities).effectivePalette.filter((c) => HEX.test(c));
    if (!palette.length) { swatch.style.background = previewOf(r); return; }
    swatch.style.backgroundColor = palette[0];
    if (palette.length < 2 || this.reduceMotion.matches || typeof swatch.animate !== 'function') return;
    swatch.animate([...palette, palette[0]].map((c) => ({ backgroundColor: c })), { duration: paletteSeconds(palette.length) * 1000, iterations: Infinity, easing: 'linear' });
  }

  private async pick(v: RoomView, r: any) {
    if (r.safety?.flashing) {
      const ok = await this.confirmFlashing(r);
      if (!ok) return;
      await this._hass.callService('input_boolean', 'turn_on', {}, { entity_id: 'input_boolean.govuk_lights_allow_flashing' });
    }
    try { await this._hass.callService('script', 'govuk_lights_apply', { room: v.cfg.id, recipe: r.id }); this.dialog!.close(); }
    catch (e) { this.toast(`Could not apply ${r.label}: ${(e as Error).message}`); }
  }
  private confirmFlashing(r: any): Promise<boolean> {
    return new Promise((res) => {
      const c = el('dialog', { class: 'dlg dlg--auto', 'aria-labelledby': 'w-title' },
        el('h3', { id: 'w-title', class: 'dlg-title' }, 'Warning: flashing lights'),
        el('p', {}, `${r.label} flashes red and blue quickly. It can trigger seizures in people with photosensitive epilepsy. It stops by itself after ${r.safety.maxRuntimeS} seconds, or when you turn the room off.`),
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn--warning', type: 'button', onclick: () => { c.close('yes'); } }, 'Start flashing'),
          el('button', { class: 'btn btn--secondary', type: 'button', autofocus: true, onclick: () => c.close('no') }, 'Cancel')));
      c.addEventListener('close', () => { res(c.returnValue === 'yes'); c.remove(); });
      this.root.append(c); c.showModal();
    });
  }
  private toast(msg: string) { if (this.status) this.status.textContent = msg; }

  private async toggle(v: RoomView) {
    if (v.on > 0) return this.stop(v, true);
    const ids = v.caps.lightCapabilities.map((c) => c.entityId); if (!ids.length) return; // reserved lights are never included
    try { await this._hass.callService('light', 'turn_on', {}, { entity_id: ids }); } catch (e) { this.toast(`Could not turn on ${v.cfg.name}: ${(e as Error).message}`); }
  }
  private async stop(v: RoomView, off: boolean) {
    try { await this._hass.callService('script', 'govuk_lights_stop', { room: v.cfg.id, turn_off: off }); } catch (e) { this.toast(`Could not stop ${v.cfg.name}: ${(e as Error).message}`); }
  }
  private async all(on: boolean) { for (const v of this.views.values()) if (on ? v.on === 0 : v.on > 0) await this.toggle(v); }

  /** Recompute only rooms whose inputs changed. */
  private refresh() {
    const snap = this.snapshot(); let changed = false;
    for (const v of this.views.values()) {
      const caps = assessRoom(snap, v.cfg, RECIPE_LIST);
      const owner = snap.states[`input_text.govuk_lights_${v.cfg.id}`]?.state ?? '';
      const on = caps.lightCapabilities.filter((c) => snap.states[c.entityId]?.state === 'on').length;
      const sig = JSON.stringify([caps.reservedLights, caps.lightCapabilities.map((c) => [c.entityId, c.status, c.color, c.colorTemp, c.dimmable, snap.states[c.entityId]?.state]), owner]);
      if (sig === v.sig) continue;
      Object.assign(v, { caps, owner, on, sig }); changed = true; this.paintRoom(v);
    }
    if (changed) {
      this.paintSummary();
      if (this.dialog?.open && this.current) { const t = this.dialog.querySelector('[aria-selected=true]')?.id.replace('tab-', '') ?? CATS[0][0]; const f = this.root.activeElement; this.renderDialog(t); if (f?.id) this.dialog.querySelector<HTMLElement>(`#${CSS.escape(f.id)}`)?.focus(); }
    }
  }
  private paintAll() { for (const v of this.views.values()) if (v.caps) this.paintRoom(v); }

  private describe(v: RoomView): string {
    const c = v.caps;
    if (c.totalLights === 0) return c.reservedLights > 0 ? 'Managed by another automation' : 'No lights';
    if (c.availableLights === 0) return 'Unavailable';
    if (v.on === 0) return 'Off';
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    const part = v.on < c.availableLights ? ' (some lights off)' : '';
    return (rec ? `On, ${rec.label}` : 'On, custom') + part;
  }

  private paintRoom(v: RoomView) {
    const uncontrolled = v.caps.totalLights === 0 || v.caps.availableLights === 0;
    v.row!.querySelector('[data-role=sub]')!.textContent = uncontrolled ? this.describe(v) : '';
    const btn = v.row!.querySelector<HTMLButtonElement>('.btn')!;
    btn.textContent = v.on > 0 ? 'Turn off' : 'Turn on'; btn.disabled = v.caps.availableLights === 0;
    btn.setAttribute('aria-label', `${v.on > 0 ? 'Turn off' : 'Turn on'} ${v.cfg.name ?? v.cfg.id}`);
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    // Floor plan: one overlay per room, driven by the effective palette.
    const shade = this.plan!.querySelector<SVGPolygonElement>(`.shade[data-room=${v.cfg.id}]`)!;
    const hit = this.plan!.querySelector(`.hit[data-room=${v.cfg.id}]`)!;
    hit.setAttribute('aria-label', `${v.cfg.name ?? v.cfg.id}, ${this.describe(v)}. Open lighting settings.`);
    shade.replaceChildren(); shade.removeAttribute('style');
    if (v.on === 0) { shade.setAttribute('class', 'shade shade--off'); return; }
    shade.setAttribute('class', 'shade shade--lit');
    let palette: string[] = [];
    if (rec) palette = buildPlan(rec, v.caps.lightCapabilities).effectivePalette;
    if (!palette.length) palette = ['#FFB76C'];
    palette = palette.filter((p) => HEX.test(p));
    shade.setAttribute('fill', palette[0]);
    if (palette.length > 1 && !this.reduceMotion.matches) {
      const a = svg('animate', { attributeName: 'fill', values: [...palette, palette[0]].join(';'), dur: `${paletteSeconds(palette.length)}s`, repeatCount: 'indefinite' });
      shade.append(a);
    } else if (palette.length > 1) shade.setAttribute('fill', palette[0]); // reduced motion: static representative colour
  }
  private paintSummary() {
    const vs = [...this.views.values()]; const on = vs.filter((v) => v.on > 0).length;
    this.status!.textContent = `${on} of ${vs.length} rooms on`;
  }
}

if (!customElements.get('govuk-house-lighting-card')) customElements.define('govuk-house-lighting-card', GovukHouseLightingCard);
(window as any).customCards = (window as any).customCards ?? [];
(window as any).customCards.push({ type: 'govuk-house-lighting-card', name: 'GOV.UK house lighting', description: 'Room lighting with floor plan, whites, colours and dynamic scenes.' });
