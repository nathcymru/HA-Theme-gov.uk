import { assessRoom } from '../../lighting/engine/capabilities.ts';
import { buildPlan } from '../../lighting/engine/plan.ts';
import type { Snapshot, RoomSource, RoomLightingCapabilities } from '../../lighting/engine/types.ts';
import RECIPES from '../../lighting/generated/recipes.json' with { type: 'json' };
import FLOOR from './rooms.json' with { type: 'json' };
import { STYLES } from './styles.ts';

const SVG = 'http://www.w3.org/2000/svg';
const RECIPE_LIST = RECIPES as any[];
const CATS: Array<[string, string]> = [['white', 'Whites'], ['color', 'Solid colours'], ['scene', 'Dynamic scenes']];
const REASONS: Record<string, string> = {
  no_lights: 'This room has no lights.', all_unavailable: 'All lights in this room are unavailable.',
  members_unavailable: 'Some lights are unavailable, so the whole room cannot be set to one colour.',
  needs_all_colour: 'Every light in this room must be able to show colour.', needs_colour_light: 'This room needs at least one colour light.',
  no_dimmable_lights: 'No light in this room can be dimmed.',
};
const ADAPT = 'This scene will adapt to the lights in this room.';
const SAFE_CSS = /^(#[0-9A-Fa-f]{6}|linear-gradient\(90deg(, #[0-9A-Fa-f]{6} \d{1,3}%)+\))$/;
const safeCss = (v: string) => (SAFE_CSS.test(v) ? v : 'transparent');
const previewOf = (r: any): string => safeCss(r.previewCss ?? r.preview);

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
    const state = el('dd', { class: 'value', 'data-role': 'state' });
    const toggle = el('button', { class: 'btn btn--small', type: 'button', onclick: () => this.toggle(v) });
    const settings = el('button', { class: 'link', type: 'button', onclick: (e: Event) => this.open(v.cfg.id, e.currentTarget as HTMLElement) }, 'Settings', el('span', { class: 'vh' }, ` for ${name}`));
    const stop = el('button', { class: 'link', type: 'button', hidden: true, onclick: () => this.stop(v, false) }, 'Stop scene', el('span', { class: 'vh' }, ` in ${name}`));
    const row = el('div', { class: 'row', 'data-room': v.cfg.id }, el('dt', { class: 'key' }, name), state, el('dd', { class: 'act' }, toggle, stop, settings));
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

  private renderDialog(tab = 'white') {
    const v = this.views.get(this.current!)!, d = this.dialog!;
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const tabs = el('div', { role: 'tablist', class: 'tabs', 'aria-label': 'Lighting type' });
    const panels = el('div');
    CATS.forEach(([cat, label]) => {
      const t = el('button', { role: 'tab', type: 'button', class: 'tab', id: `tab-${cat}`, 'aria-controls': `panel-${cat}`, 'aria-selected': String(cat === tab), tabindex: cat === tab ? 0 : -1,
        onclick: () => this.renderDialog(cat),
        onkeydown: (e: KeyboardEvent) => { const i = CATS.findIndex((c) => c[0] === cat); const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1; if (n >= 0) { e.preventDefault(); this.renderDialog(CATS[(n + CATS.length) % CATS.length][0]); this.dialog!.querySelector<HTMLElement>('[aria-selected=true]')!.focus(); } } }, label);
      tabs.append(t);
      const p = el('div', { role: 'tabpanel', id: `panel-${cat}`, 'aria-labelledby': `tab-${cat}`, hidden: cat !== tab });
      const grid = el('ul', { class: 'tiles' });
      for (const r of RECIPE_LIST.filter((x) => x.category === cat)) {
        const a = avail.get(r.id)!; const off = a.availability === 'unsupported';
        const note = off ? REASONS[a.reason ?? ''] ?? 'Not available in this room.' : a.availability === 'adaptive' ? ADAPT : '';
        const swatch = el('span', { class: 'swatch' }); swatch.style.background = previewOf(r);
        const selected = v.owner === r.id;
        const btn = el('button', { class: 'tile', type: 'button', disabled: off, 'aria-pressed': String(selected), 'aria-describedby': note ? `n-${r.id}` : undefined, onclick: () => this.pick(v, r) }, swatch, el('span', { class: 'tile-label' }, r.label));
        grid.append(el('li', {}, btn, note ? el('p', { id: `n-${r.id}`, class: 'note' }, note) : ''));
      }
      p.append(grid); panels.append(p);
    });
    d.replaceChildren(el('h3', { id: 'dlg-title', class: 'dlg-title' }, `${v.cfg.name ?? v.cfg.id} lighting`), tabs, panels,
      el('button', { class: 'btn btn--secondary', type: 'button', onclick: () => d.close() }, 'Close'));
    // Confirm dialog for flashing scenes is created on demand in pick().
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
      const c = el('dialog', { class: 'dlg', 'aria-labelledby': 'w-title' },
        el('h3', { id: 'w-title', class: 'dlg-title' }, 'Warning: flashing lights'),
        el('p', {}, `${r.label} flashes red and blue quickly. It can trigger seizures in people with photosensitive epilepsy. It stops by itself after ${r.safety.maxRuntimeS} seconds, or when you select Stop scene.`),
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
    const area = v.cfg.area; if (!area) return;
    try { await this._hass.callService('light', 'turn_on', {}, { area_id: area }); } catch (e) { this.toast(`Could not turn on ${v.cfg.name}: ${(e as Error).message}`); }
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
      const sig = JSON.stringify([caps.lightCapabilities.map((c) => [c.entityId, c.status, c.color, c.colorTemp, c.dimmable, snap.states[c.entityId]?.state]), owner]);
      if (sig === v.sig) continue;
      Object.assign(v, { caps, owner, on, sig }); changed = true; this.paintRoom(v);
    }
    if (changed) {
      this.paintSummary();
      if (this.dialog?.open && this.current) { const t = this.dialog.querySelector('[aria-selected=true]')?.id.replace('tab-', '') ?? 'white'; const f = this.root.activeElement; this.renderDialog(t); if (f?.id) this.dialog.querySelector<HTMLElement>(`#${CSS.escape(f.id)}`)?.focus(); }
    }
  }
  private paintAll() { for (const v of this.views.values()) if (v.caps) this.paintRoom(v); }

  private describe(v: RoomView): string {
    const c = v.caps;
    if (c.totalLights === 0) return 'No lights';
    if (c.availableLights === 0) return 'Unavailable';
    if (v.on === 0) return 'Off';
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    const part = v.on < c.availableLights ? ' (some lights off)' : '';
    return (rec ? `On, ${rec.label}` : 'On, custom') + part;
  }

  private paintRoom(v: RoomView) {
    const st = v.row!.querySelector('[data-role=state]')!; st.textContent = this.describe(v);
    const btn = v.row!.querySelector<HTMLButtonElement>('.btn')!;
    btn.textContent = v.on > 0 ? 'Turn off' : 'Turn on'; btn.disabled = v.caps.availableLights === 0;
    btn.setAttribute('aria-label', `${v.on > 0 ? 'Turn off' : 'Turn on'} ${v.cfg.name ?? v.cfg.id}`);
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    (v.row!.querySelectorAll('.link')[0] as HTMLElement).hidden = !(rec?.category === 'scene' && v.on > 0);
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
    palette = palette.filter((p) => /^#[0-9A-Fa-f]{6}$/.test(p));
    shade.setAttribute('fill', palette[0]);
    if (palette.length > 1 && !this.reduceMotion.matches) {
      const a = svg('animate', { attributeName: 'fill', values: [...palette, palette[0]].join(';'), dur: `${Math.max(4, palette.length * 3)}s`, repeatCount: 'indefinite' });
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
