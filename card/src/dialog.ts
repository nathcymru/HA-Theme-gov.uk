// Restyles Home Assistant's own more-info dialog for a room's light group.
//
// Why this exists: Home Assistant 2026.11 builds the dialog from its own components (slider,
// colour wheel, temperature) and sizes it itself. card-mod 4.2.1 cannot reach the new dialog, so
// theme CSS cannot change its layout. We keep every Home Assistant control (they still call the
// light services), and only (1) restyle them with GOV.UK tokens from the theme, (2) lay them out
// horizontally so the dialog needs no scrolling, and (3) add the room's scene buttons.
// Nothing here reads or writes light state itself; scenes call script.govuk_lights_apply.

export interface DialogScene { id: string; label: string; iconUrl: string; fill: (swatch: HTMLElement) => void; pressed: boolean }
export interface DialogSpec { title: string; scenes: DialogScene[]; onPick: (id: string) => void }

const MORE_INFO_LIGHT_CSS = `
:host { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-content: start; flex: 0 0 auto; font-family: var(--ha-font-family-body, inherit); color: var(--primary-text-color); }
ha-more-info-state-header { grid-column: 1 / -1; }
.controls { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: center; justify-items: stretch; margin: 0 !important; flex: none; }
.controls > * { margin: 0 !important; }
ha-state-control-light-brightness { width: 100%; }
ha-icon-button-group { justify-self: start; }
.button-bar, .buttons { max-width: none; justify-content: flex-start; }
.button-bar { border-radius: 0; background: transparent; }
.buttons > * { margin: 4px 4px 4px 0; }
.govuk-scenes { display: block; border-left: 5px solid var(--divider-color); padding-left: 12px; }
.govuk-scenes h3 { margin: 0 0 8px; font: var(--ha-font-weight-bold, 700) 1rem/1.25 var(--ha-font-family-body, inherit); color: var(--primary-text-color); }
.govuk-scenes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.govuk-tile { position: relative; display: block; width: 40px; height: 40px; padding: 0; cursor: pointer; overflow: hidden; background: var(--card-background-color); border: 2px solid var(--primary-text-color); border-radius: 0; }
.govuk-tile[aria-pressed=true] { outline: 3px solid var(--primary-text-color); outline-offset: 2px; }
.govuk-tile:focus-visible { outline: 3px solid var(--ha-color-focus, var(--accent-color)); outline-offset: 0; box-shadow: 0 4px 0 var(--primary-text-color); }
.govuk-swatch { position: absolute; inset: 0; display: block; }
.govuk-swatch::after { content: ""; position: absolute; inset: 0; background: color-mix(in srgb, var(--primary-text-color) 40%, transparent); }
.govuk-tile img { position: absolute; inset: 5px; width: calc(100% - 10px); height: calc(100% - 10px); object-fit: contain; pointer-events: none; filter: brightness(0) invert(1); }
.govuk-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

// A horizontal, GOV.UK-shaped slider: square corners, 1px outline in the text colour, no rounded thumb.
// Home Assistant shows the light controls and, for a group, a section of its member lights. Side by
// side on desktop and tablet; stacked on mobile.
const CONTENT_CSS = `
@media (min-width: 700px) { :host { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; } }
`;

const SLIDER_CSS = `
ha-control-slider {
  --control-slider-thickness: 40px;
  --control-slider-border-radius: 0px;
  --control-slider-color: var(--primary-color);
  --control-slider-background: var(--secondary-background-color);
  --control-slider-background-opacity: 1;
  width: 100%; height: 40px !important; min-height: 0 !important; max-height: none !important;
  border: 2px solid var(--primary-text-color); box-sizing: border-box;
}
`;

const sheets = new WeakSet<ShadowRoot>();
function addSheet(root: ShadowRoot, css: string) {
  if (sheets.has(root)) return;
  const s = new CSSStyleSheet(); s.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, s]; sheets.add(root);
}

function findDeep(root: ParentNode, selector: string): HTMLElement | null {
  const hit = root.querySelector<HTMLElement>(selector); if (hit) return hit;
  for (const e of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (e.shadowRoot) { const r = findDeep(e.shadowRoot, selector); if (r) return r; }
  }
  return null;
}

function sizeDialog(dialogHost: HTMLElement) {
  const haDialog = findDeep(dialogHost.shadowRoot ?? dialogHost, 'ha-dialog');
  if (!haDialog) return;
  const v: Record<string, string> = {
    '--ha-dialog-width-md': '920px', '--ha-dialog-width-lg': '920px',
    '--ha-dialog-max-width': 'min(920px, calc(100vw - 32px))',
    '--ha-dialog-max-height': 'min(580px, calc(100vh - 32px))', '--ha-dialog-min-height': '0px',
    '--ha-dialog-border-radius': '0px',
  };
  for (const [k, val] of Object.entries(v)) haDialog.style.setProperty(k, val);
}

function paintScenes(host: ShadowRoot, spec: DialogSpec) {
  host.querySelector('.govuk-scenes')?.remove();
  if (!spec.scenes.length) return;
  const sec = document.createElement('section'); sec.className = 'govuk-scenes';
  const h = document.createElement('h3'); h.textContent = 'Scenes'; sec.append(h);
  const ul = document.createElement('ul');
  for (const sc of spec.scenes) {
    const li = document.createElement('li'); const b = document.createElement('button');
    b.type = 'button'; b.className = 'govuk-tile'; b.title = sc.label; b.setAttribute('aria-pressed', String(sc.pressed));
    const sw = document.createElement('span'); sw.className = 'govuk-swatch'; sc.fill(sw);
    const img = document.createElement('img'); img.src = sc.iconUrl; img.alt = '';
    const vh = document.createElement('span'); vh.className = 'govuk-vh'; vh.textContent = sc.label;
    b.append(sw, img, vh); b.addEventListener('click', () => spec.onPick(sc.id)); li.append(b); ul.append(li);
  }
  sec.append(ul);
  // Sit beside the brightness controls, before the effect menu.
  host.querySelector('.controls')?.after(sec);
}

/** Waits (up to 6 seconds) for the dialog to render, then restyles it. Safe to call more than once. */
export function tuneMoreInfo(spec: DialogSpec): void {
  const started = performance.now();
  const tick = () => {
    const ha = document.querySelector('home-assistant');
    const dlg = ha?.shadowRoot ? findDeep(ha.shadowRoot, 'ha-more-info-dialog') : null;
    const ml = dlg?.shadowRoot ? findDeep(dlg.shadowRoot, 'more-info-light') : null;
    const sr = ml?.shadowRoot;
    if (dlg && ml && sr && sr.querySelector('.controls')) {
      sizeDialog(dlg); addSheet(sr, MORE_INFO_LIGHT_CSS);
      const content = dlg.shadowRoot ? findDeep(dlg.shadowRoot, 'more-info-content') : null;
      if (content?.shadowRoot) addSheet(content.shadowRoot, CONTENT_CSS);
      const sc = sr.querySelector<HTMLElement>('ha-state-control-light-brightness');
      const slider = sc?.shadowRoot?.querySelector<any>('ha-control-slider');
      if (sc?.shadowRoot && slider) {
        addSheet(sc.shadowRoot, SLIDER_CSS);
        slider.vertical = false; slider.removeAttribute('vertical'); slider.setAttribute('aria-orientation', 'horizontal');
      }
      paintScenes(sr, spec);
      return;
    }
    if (performance.now() - started < 6000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
