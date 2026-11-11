import { assessRoom } from '../../lighting/engine/capabilities.ts';
import { buildPlan } from '../../lighting/engine/plan.ts';
import type { Snapshot, RoomSource, RoomLightingCapabilities } from '../../lighting/engine/types.ts';
import RECIPES from '../../lighting/generated/recipes.json' with { type: 'json' };
import FLOOR from './rooms.json' with { type: 'json' };
import { STYLES } from './styles.ts';
import { tuneMoreInfo } from './dialog.ts';

const SVG = 'http://www.w3.org/2000/svg';
const RECIPE_LIST = RECIPES as any[];
// Use Home Assistant's existing icon vocabulary; labels identify each action.
const SCENE_ICONS: Record<string, string> = { christmas: 'mdi:string-lights', football: 'mdi:soccer', rugby: 'mdi:rugby', halloween: 'mdi:halloween', emergency: 'mdi:alarm-light-outline' };
const COG = 'M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.86,17.38L11.25,20H12.75L13.12,17.4C14.32,17.14 15.38,16.5 16.15,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.38C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z';
// The only external link in the card: plain help text, never fetched.
const AREAS_DOCS = 'https://www.home-assistant.io/docs/organizing/areas/';
const SAFE_CSS = /^(#[0-9A-Fa-f]{6}|linear-gradient\(90deg(, #[0-9A-Fa-f]{6} \d{1,3}%)+\))$/;
const safeCss = (v: string) => (SAFE_CSS.test(v) ? v : 'transparent');
const previewOf = (r: any): string => safeCss(r.previewCss ?? r.preview);
const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Same pace as the floor-plan tint, so a scene preview and its room change colour together. */
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

interface RoomCfg extends RoomSource { group?: string }
interface Config { type: string; title?: string; rooms: RoomCfg[]; image?: string }
interface RoomView { cfg: RoomCfg; caps: RoomLightingCapabilities; sig: string; on: number; owner: string; row?: HTMLElement; poly?: SVGPolygonElement }
interface RoomRequest { target: 'on' | 'off'; ids: string[]; phase: 'sending' | 'accepted' | 'reported' | 'unconfirmed' | 'failed'; inFlight: boolean; timer?: ReturnType<typeof setTimeout> }
const REQUEST_WAIT_MS = 20000;

class GovukHouseLightingCard extends HTMLElement {
  private _hass: any; private config!: Config; private root: ShadowRoot; private views = new Map<string, RoomView>();
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private onMotion = () => this.paintAll();
  private cancelMoreInfo?: () => void;
  private actionPending = false;
  private requests = new Map<string, RoomRequest>();
  private requestGeneration = 0;
  private status?: HTMLElement; private errorSlot?: HTMLElement; private errors: Array<{ room?: string; msg: string }> = []; private list?: HTMLElement; private plan?: SVGElement; private built = false;

  constructor() { super(); this.root = this.attachShadow({ mode: 'open' }); }

  static getStubConfig() { return { type: 'custom:civica-house-lighting-card' }; }
  setConfig(config: Partial<Config>) {
    this.cancelMoreInfo?.();
    this.clearRequests();
    if (!config || config.type === undefined) throw new Error('civica-house-lighting-card: "type" is required');
    const rooms = config.rooms ?? FLOOR.rooms;
    if (!Array.isArray(rooms) || !rooms.length) throw new Error('"rooms" must be a non-empty list');
    const ids = new Set<string>();
    for (const r of rooms as RoomCfg[]) {
      if (!r.id || !/^[a-z][a-z0-9_]*$/.test(r.id)) throw new Error(`room id "${r.id}" is invalid (lowercase letters, digits, underscore)`);
      if (ids.has(r.id)) throw new Error(`duplicate room id "${r.id}"`);
      ids.add(r.id);
      if (r.group && !/^light\.[a-z0-9_]+$/.test(r.group)) throw new Error(`room "${r.id}" group must be a light entity ID`);
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
  connectedCallback() { this.reduceMotion.addEventListener('change', this.onMotion); if (this.built && this._hass) { this.paintAll(); this.paintSummary(); } }
  disconnectedCallback() { this.reduceMotion.removeEventListener('change', this.onMotion); this.cancelMoreInfo?.(); this.clearRequests(); }

  private clearRequests() {
    // Retire this UI's pending batch. An already-sent service call may still run,
    // but its completion must not send later rooms or unlock a newer batch.
    this.requestGeneration++;
    this.actionPending = false;
    for (const request of this.requests.values()) clearTimeout(request.timer);
    this.requests.clear();
  }
  private requestPending(v: RoomView) {
    const request = this.requests.get(v.cfg.id);
    return !!request && (request.inFlight || request.phase === 'sending' || request.phase === 'accepted');
  }

  private snapshot(): Snapshot { const h = this._hass; return { entities: h.entities ?? {}, devices: h.devices ?? {}, states: h.states }; }

  private build() {
    this.built = true;
    const style = el('style'); style.textContent = STYLES;
    const title = el('h2', { class: 'title' }, this.config.title!);
    this.status = el('p', { class: 'status', role: 'status' });
    this.errorSlot = el('div', { class: 'error-slot' });
    // GOV.UK: avoid several default buttons, so every button here is secondary.
    const all = el('div', { class: 'actions' },
      el('button', { class: 'btn btn--secondary', type: 'button', 'data-role': 'all-on', onclick: () => this.all(true) }, 'Turn all on'),
      el('button', { class: 'btn btn--secondary', type: 'button', 'data-role': 'all-off', onclick: () => this.all(false) }, 'Turn all off'));
    this.list = el('dl', { class: 'rooms' });
    this.plan = this.buildPlan();
    // Floor plan first, then the room list.
    this.root.replaceChildren(style, el('ha-card', {}, el('div', { class: 'body' }, el('div', { class: 'head' }, title, all), this.errorSlot!, this.status!, this.plan!, this.list!, this.buildHelp())));
    for (const cfg of this.config.rooms) this.views.set(cfg.id, { cfg, caps: undefined as any, sig: '', on: 0, owner: '' });
    for (const v of this.views.values()) this.list!.append(this.buildRow(v));
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
      hit.addEventListener('click', () => { if (this.usable(this.views.get(cfg.id)!)) this.openMoreInfo(cfg.id); });
      hit.addEventListener('keydown', (e) => { const k = (e as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); if (this.usable(this.views.get(cfg.id)!)) this.openMoreInfo(cfg.id); } });
      s.append(hit);
    }
    return s;
  }

  private buildRow(v: RoomView): HTMLElement {
    const name = v.cfg.name ?? v.cfg.id;
    // Turn on/off is the primary action; Settings is the secondary button with the authorised cog (icon only).
    const toggle = el('button', { class: 'btn', type: 'button', 'data-role': 'toggle', onclick: () => this.toggle(v) });
    const icon = svg('svg', { viewBox: '0 0 24 24', width: 24, height: 24, class: 'btn-icon', 'aria-hidden': 'true', focusable: 'false' });
    icon.append(svg('path', { d: COG, fill: 'currentColor' }));
    const settings = el('button', { class: 'btn btn--secondary', type: 'button', 'data-role': 'settings', title: 'Settings', onclick: () => this.openMoreInfo(v.cfg.id) }, icon, el('span', { class: 'vh' }, `Settings for ${name}`));
    const requestStatus = el('dd', { class: 'request-status', role: 'status', 'data-role': 'request-status' });
    const row = el('div', { class: 'row', 'data-room': v.cfg.id }, el('dt', { class: 'key' }, name, el('span', { class: 'sub', 'data-role': 'sub' })), el('dd', { class: 'act' }, toggle, settings), requestStatus, el('dd', { class: 'scenes-slot', 'data-role': 'scenes' }));
    v.row = row; return row;
  }

  private usable(v: RoomView) { return !!v.caps && v.caps.availableLights > 0; }

  /** GOV.UK details component: help for lights or rooms that do not appear. Copy follows the GOV.UK A to Z style guide. */
  private buildHelp(): HTMLElement {
    const strong = (t: string) => el('strong', {}, t);
    return el('details', { class: 'details' },
      el('summary', { class: 'details-summary' }, el('span', { class: 'details-summary-text' }, 'Missing lights or rooms?')),
      el('div', { class: 'details-text' },
        el('p', {}, 'Lights might not appear in a room if they are not smart bulbs, are in the wrong area or are offline.'),
        el('p', {}, 'To fix this, select ', strong('Settings'), ', then ', strong('Devices and services'), '. Check your connected devices and make sure each light is in the correct area.'),
        el('p', {}, 'If you still have trouble, select ', strong('Settings'), ', then ', strong('System'), ', then ', strong('Logs'), ' to find error details. You can also read the ',
          el('a', { class: 'link', href: AREAS_DOCS, target: '_blank', rel: 'noreferrer noopener' }, 'Home Assistant areas documentation (opens in new tab)'), ' for help organising your home.')));
  }

  /** Settings opens Home Assistant's own more-info dialog (slider, colour wheel and temperature) for the room's light group. */
  private openMoreInfo(roomId: string) {
    const v = this.views.get(roomId)!;
    // Generated HA group names normally become light.lights_<room>. Preserve
    // legacy IDs and allow explicit renamed groups, but never bypass ownership
    // exclusions by opening a group that also controls reserved/out-of-room lights.
    const managed = new Set(v.caps.lightCapabilities.map((capability) => capability.entityId));
    const safeMembers = (id: string, seen = new Set<string>()): boolean => {
      if (seen.has(id) || !id.startsWith('light.') || !this._hass.states[id]) return false;
      const members = this._hass.states[id].attributes?.entity_id;
      if (!Array.isArray(members)) return managed.has(id);
      const visited = new Set(seen).add(id);
      return members.length > 0 && members.every((member: unknown) => typeof member === 'string' && safeMembers(member, visited));
    };
    const candidates = v.cfg.group ? [v.cfg.group] : [`light.govuk_lights_${roomId}`, `light.lights_${roomId}`];
    const group = candidates.find((id) => {
      const state = this._hass.states[id];
      return state && !['unknown', 'unavailable'].includes(state.state) && Array.isArray(state.attributes?.entity_id) && safeMembers(id);
    });
    const entityId = group ?? v.caps.lightCapabilities.find((c) => c.status === 'available')?.entityId;
    if (!entityId) { this.showError(`${v.cfg.name ?? v.cfg.id} has no light to open.`, roomId); return; }
    this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId } }));
    // Preserve native controls and scrolling; add scoped, labelled room scenes.
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const scenes = this.usable(v) ? RECIPE_LIST.filter((r) => r.category === 'scene' && avail.get(r.id)?.availability !== 'unsupported') : [];
    this.cancelMoreInfo = tuneMoreInfo({
      entityId, title: v.cfg.name ?? v.cfg.id,
      scenes: scenes.map((r) => ({
        id: r.id, label: r.label, pressed: v.owner === r.id,
        icon: SCENE_ICONS[r.id] ?? 'mdi:lightbulb-outline',
        fill: (swatch) => this.animateSwatch(swatch, r, v),
      })),
      onPick: async (id) => { const r = scenes.find((x) => x.id === id); return r ? this.pick(v, r) : false; },
    });
  }

  /** Cycles the room's effective scene palette at the same pace as the floor-plan tint. Static when motion is reduced. */
  private animateSwatch(swatch: HTMLElement, r: any, v: RoomView) {
    const palette = buildPlan(r, v.caps.lightCapabilities).effectivePalette.filter((c) => HEX.test(c));
    if (!palette.length) { swatch.style.background = previewOf(r); return; }
    swatch.style.backgroundColor = palette[0];
    if (palette.length < 2 || this.reduceMotion.matches || typeof swatch.animate !== 'function') return;
    swatch.animate([...palette, palette[0]].map((c) => ({ backgroundColor: c })), { duration: paletteSeconds(palette.length) * 1000, iterations: Infinity, easing: 'linear' });
  }

  /** Per-room slot for the GOV.UK inline error message. Scenes are not shown on the card unless Nathan asks for them. */
  private paintScenes(v: RoomView) {
    const slot = v.row!.querySelector<HTMLElement>('[data-role=scenes]')!;
    const err = this.errors.filter((e) => e.room === v.cfg.id);
    // GOV.UK error message component: static text, "Error:" prefix for screen readers, red left border.
    const body = err.length ? [el('div', { class: 'form-group--error', tabindex: -1, id: `error-${v.cfg.id}` }, ...err.map((e) => el('p', { class: 'error-message' }, el('span', { class: 'vh' }, 'Error:'), ` ${e.msg}`)))] : [];
    slot.replaceChildren(...body);
  }

  private async pick(v: RoomView, r: any): Promise<boolean> {
    this.clearErrors();
    try {
      if (r.safety?.flashing) {
        if (!await this.confirmFlashing(r)) return false;
        await this._hass.callService('input_boolean', 'turn_on', {}, { entity_id: 'input_boolean.govuk_lights_allow_flashing' });
      }
      await this._hass.callService('script', 'govuk_lights_apply', { room: v.cfg.id, recipe: r.id });
      return true;
    } catch (e) {
      console.error('civica-house-lighting-card', e);
      this.showError(`${r.label} could not be applied in ${v.cfg.name ?? v.cfg.id}. Try again. If it keeps failing, check the Home Assistant log.`, v.cfg.id);
      throw e; // The open native dialog also announces the failure.
    }
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
  /** GOV.UK error summary at the top of the card; each item links to the room it concerns, which also shows the inline error message. */
  private errorSummary(): HTMLElement | undefined {
    if (!this.errors.length) return undefined;
    const link = (e: { room?: string; msg: string }) => e.room
      ? el('a', { class: 'link', href: `#error-${e.room}`, onclick: (ev: Event) => { ev.preventDefault(); this.root.querySelector<HTMLElement>(`#error-${e.room}`)?.focus(); } }, e.msg)
      : e.msg;
    return el('div', { class: 'error-summary', tabindex: -1, 'data-role': 'error-summary' },
      el('div', { role: 'alert' }, el('h2', { class: 'error-summary__title' }, 'There is a problem'),
        el('ul', { class: 'error-summary__list' }, ...this.errors.map((e) => el('li', {}, link(e))))));
  }
  private showError(msg: string, room?: string) {
    if (!this.errors.some((e) => e.msg === msg && e.room === room)) this.errors.push({ room, msg });
    this.paintErrors(true);
  }
  private clearErrors() { if (this.errors.length) { this.errors = []; this.paintErrors(false); } }
  private paintErrors(focus: boolean) {
    const card = this.errorSummary(); this.errorSlot?.replaceChildren(...(card ? [card] : []));
    for (const v of this.views.values()) if (v.caps) this.paintScenes(v);
    if (focus) this.errorSlot?.querySelector<HTMLElement>('[data-role=error-summary]')?.focus();
  }

  private async toggle(v: RoomView, preserveErrors = false) {
    if (!this.usable(v) || this.actionPending || this.requestPending(v)) return;
    if (!preserveErrors) this.clearErrors();
    if (v.on > 0) return this.stop(v, true);
    return this.turnOn(v);
  }
  private async turnOn(v: RoomView) {
    const ids = v.caps.lightCapabilities.filter((c) => c.status === 'available').map((c) => c.entityId); if (!ids.length) return; // reserved lights are never included
    await this.request(v, 'on', ids, () => this._hass.callService('light', 'turn_on', {}, { entity_id: ids }));
  }
  private async stop(v: RoomView, off: boolean) {
    const ids = v.caps.lightCapabilities.filter(c => c.status === 'available').map(c => c.entityId);
    await this.request(v, 'off', ids, () => this._hass.callService('script', 'govuk_lights_stop', { room: v.cfg.id, turn_off: off }));
  }
  private async request(v: RoomView, target: 'on' | 'off', ids: string[], send: () => Promise<unknown>) {
    if (this.requestPending(v) || !ids.length) return;
    clearTimeout(this.requests.get(v.cfg.id)?.timer);
    const request: RoomRequest = { target, ids, phase: 'sending', inFlight: true };
    this.requests.set(v.cfg.id, request);
    request.timer = setTimeout(() => {
      if (this.requests.get(v.cfg.id) !== request || request.phase === 'reported' || request.phase === 'failed') return;
      request.phase = 'unconfirmed'; this.paintRoom(v); this.paintSummary();
    }, REQUEST_WAIT_MS);
    this.paintRoom(v); this.paintSummary();
    try {
      await send();
      if (this.requests.get(v.cfg.id) !== request) return;
      request.inFlight = false;
      if (request.phase === 'sending') request.phase = 'accepted';
      this.observeRequest(v);
    } catch (e) {
      if (this.requests.get(v.cfg.id) !== request) return;
      request.inFlight = false; request.phase = 'failed'; clearTimeout(request.timer);
      console.error('civica-house-lighting-card', e);
      this.showError(`${v.cfg.name ?? v.cfg.id} could not confirm the turn-${target} request. Check the current state before trying again.`, v.cfg.id);
    } finally {
      if (this.requests.get(v.cfg.id) === request) { this.paintRoom(v); this.paintSummary(); }
    }
  }
  private observeRequest(v: RoomView) {
    const request = this.requests.get(v.cfg.id);
    if (!request || request.inFlight || request.phase === 'failed' || request.phase === 'reported') return;
    // State is observed independently: an accepted call is not proof of cause.
    if (request.ids.every(id => this._hass.states[id]?.state === request.target && this._hass.states[id]?.attributes?.assumed_state !== true)) {
      request.phase = 'reported'; clearTimeout(request.timer);
    }
  }
  private async all(on: boolean) {
    if (this.actionPending || [...this.views.values()].some(v => this.requestPending(v))) return;
    const generation = this.requestGeneration;
    this.actionPending = true; this.clearErrors(); this.paintAll(); this.paintSummary();
    try {
      for (const v of this.views.values()) {
        if (generation !== this.requestGeneration) break;
        if (this.usable(v)) { if (on) await this.turnOn(v); else if (v.on > 0) await this.stop(v, true); }
      }
    } finally {
      if (generation === this.requestGeneration) { this.actionPending = false; this.paintAll(); this.paintSummary(); }
    }
  }

  /** Recompute only rooms whose inputs changed. */
  private refresh() {
    const snap = this.snapshot(); let changed = false;
    for (const v of this.views.values()) {
      const caps = assessRoom(snap, v.cfg, RECIPE_LIST);
      const owner = snap.states[`input_text.govuk_lights_${v.cfg.id}`]?.state ?? '';
      const on = caps.lightCapabilities.filter((c) => snap.states[c.entityId]?.state === 'on').length;
      const sig = JSON.stringify([caps.reservedLights, caps.lightCapabilities.map((c) => [c.entityId, c.status, c.color, c.colorTemp, c.dimmable, snap.states[c.entityId]?.state, snap.states[c.entityId]?.attributes?.assumed_state]), owner]);
      this.observeRequest(v);
      if (sig === v.sig) { this.paintRequest(v); continue; }
      Object.assign(v, { caps, owner, on, sig }); changed = true; this.paintRoom(v);
    }
    if (changed) {
      this.paintSummary();
    }
  }
  private paintAll() { for (const v of this.views.values()) if (v.caps) this.paintRoom(v); }

  /** Available, unavailable and unknown managed members stay distinct. */
  private count(v: RoomView): string {
    const { availableLights: total, unavailableLights: unavailable, unknownLights: unknown } = v.caps;
    const word = `light${total === 1 ? '' : 's'}`, parts: string[] = [];
    if (total) parts.push(v.on > 0 ? `${v.on} of ${total}${unavailable || unknown ? ' available' : ''} ${word} on` : `${total} of ${total}${unavailable || unknown ? ' available' : ''} ${word} off`);
    if (unavailable) parts.push(`${unavailable} light${unavailable === 1 ? '' : 's'} unavailable`);
    if (unknown) parts.push(`${unknown} light${unknown === 1 ? '' : 's'} unknown`);
    return parts.join('; ') || (v.caps.reservedLights ? 'Lights controlled elsewhere' : 'No lights assigned');
  }
  private describe(v: RoomView): string {
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    return `${this.count(v)}${v.on > 0 && rec ? `, ${rec.label}` : ''}`;
  }

  private paintRoom(v: RoomView) {
    const usable = this.usable(v), pending = this.requestPending(v);
    v.row!.hidden = false; // Keep unavailable rooms visible with an explanation.
    v.row!.querySelector('[data-role=sub]')!.textContent = this.count(v);
    v.row!.querySelector<HTMLButtonElement>('[data-role=settings]')!.disabled = !usable;
    const btn = v.row!.querySelector<HTMLButtonElement>('[data-role=toggle]')!;
    btn.hidden = false;
    btn.textContent = pending ? 'Request pending' : !usable ? 'Unavailable' : v.on > 0 ? 'Turn off' : 'Turn on'; btn.disabled = !usable || pending || this.actionPending;
    btn.setAttribute('aria-label', `${pending ? 'Request pending for' : !usable ? 'Unavailable:' : v.on > 0 ? 'Turn off' : 'Turn on'} ${v.cfg.name ?? v.cfg.id}`);
    this.paintScenes(v);
    this.paintRequest(v);
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    // Floor plan: one overlay per room, driven by the effective palette.
    const shade = this.plan!.querySelector<SVGPolygonElement>(`.shade[data-room=${v.cfg.id}]`)!;
    const hit = this.plan!.querySelector(`.hit[data-room=${v.cfg.id}]`)!;
    hit.setAttribute('aria-label', `${v.cfg.name ?? v.cfg.id}, ${this.describe(v)}.${this.usable(v) ? ' Open lighting settings.' : ''}`);
    hit.setAttribute('aria-disabled', String(!this.usable(v)));
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
  private paintRequest(v: RoomView) {
    const request = this.requests.get(v.cfg.id), slot = v.row?.querySelector<HTMLElement>('[data-role=request-status]');
    if (!slot) return;
    const name = v.cfg.name ?? v.cfg.id;
    const message = !request ? '' : request.phase === 'sending' ? `Sending the request to turn ${name} ${request.target}. The last reported state is shown above.`
      : request.phase === 'accepted' ? `Request accepted. Waiting for the requested lights to report ${request.target}.`
      : request.phase === 'reported' ? `Request accepted. The requested lights reported ${request.target}. Their current state is shown above.`
      : request.phase === 'unconfirmed' ? `The requested change is not confirmed. Check the current state before trying again.${request.inFlight ? ' The original request is still pending.' : ''}`
      : 'The request was not confirmed. Check the current state before trying again.';
    if (slot.textContent !== message) slot.textContent = message;
  }
  private paintSummary() {
    const vs = [...this.views.values()].filter((v) => this.usable(v)); const on = vs.filter((v) => v.on > 0).length;
    this.status!.textContent = vs.length ? `${on} of ${vs.length} available rooms on` : 'No lights are available. Check the rooms below.';
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-role=all-on], [data-role=all-off]')) b.disabled = this.actionPending || [...this.views.values()].some(v => this.requestPending(v)) || !vs.length;
  }
}

if (!customElements.get('govuk-house-lighting-card')) customElements.define('govuk-house-lighting-card', GovukHouseLightingCard);
(window as any).customCards = (window as any).customCards ?? [];
if (!customElements.get('civica-house-lighting-card')) customElements.define('civica-house-lighting-card', class extends GovukHouseLightingCard {});
(window as any).customCards.push({ type: 'civica-house-lighting-card', name: 'civica.uk house lighting', description: 'Room lighting with floor plan, whites, colours and dynamic scenes.' });
