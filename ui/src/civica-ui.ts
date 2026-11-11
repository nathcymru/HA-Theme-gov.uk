import { selectedVariant } from './theme-settings';
import type { CivicaThemeSettings, ThemeHass } from './theme-settings';

// The theme tokens are the supported foundation. This small optional adapter
// is deliberately limited to four known HA elements; it does not patch Lit,
// attachShadow, routing, native controls, Energy, Map or device services.
const assetBase = new URL('./brand/', import.meta.url);
type App = HTMLElement & { hass?: ThemeHass };
const originalTitles = new Map<HTMLElement, Node[]>();
const originalIcons = new Map<HTMLLinkElement, Record<string, string | null>>();
const sidebarStyles = new Set<HTMLStyleElement>();
let ownIcon: HTMLLinkElement | undefined;
let queued: ReturnType<typeof setTimeout> | undefined;
let remaining = 0;

function findAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (element.shadowRoot) found.push(...findAll(element.shadowRoot, selector));
  }
  return found;
}
function updateBrand(app: App, targets: HTMLElement[]) {
  for (const title of originalTitles.keys()) if (!title.isConnected) originalTitles.delete(title);
  for (const icon of originalIcons.keys()) if (!icon.isConnected) originalIcons.delete(icon);
  for (const style of sidebarStyles) if (!style.isConnected) sidebarStyles.delete(style);
  const name = app.hass?.themes.theme || app.hass?.selectedTheme?.theme || app.hass?.themes.default_theme || '';
  const variant = selectedVariant(app.hass);
  const active = !app.hass?.config?.safe_mode && !app.hass?.config?.recovery_mode &&
    Boolean(app.hass?.themes.themes[name]) && Boolean(variant);
  if (!active) {
    for (const [title, children] of originalTitles) title.replaceChildren(...children);
    originalTitles.clear();
    for (const style of sidebarStyles) style.remove();
    sidebarStyles.clear();
    for (const [icon, attributes] of originalIcons) for (const [name, value] of Object.entries(attributes)) value === null ? icon.removeAttribute(name) : icon.setAttribute(name, value);
    originalIcons.clear(); ownIcon?.remove(); ownIcon = undefined;
    return;
  }
  // Artwork is supplied for palette/tone, not display mode. The masthead keeps
  // its exact primary colour in light and dark mode, so the same original file
  // works in both. Never recolour the supplied separator dot with CSS filters.
  const variantPath = `themes/${variant!.palette.id}/${variant!.muted ? 'muted' : 'vivid'}/`;
  for (const host of targets.filter(el => el.localName === 'hass-subpage' || el.localName === 'ha-top-app-bar-fixed')) {
    if (host.shadowRoot && !host.shadowRoot.querySelector('[data-civica-toolbar]')) {
      const style = document.createElement('style'); style.dataset.civicaToolbar = '';
      style.textContent = host.localName === 'hass-subpage'
        ? '.toolbar { --sidebar-icon-color: var(--app-header-text-color); --sidebar-text-color: var(--app-header-text-color); --wa-focus-ring-color: var(--ha-color-focus); }'
        : '.top-app-bar { --wa-focus-ring-color: var(--ha-color-focus); }';
      host.shadowRoot.append(style); sidebarStyles.add(style);
    }
  }
  for (const sidebar of targets.filter(el => el.localName === 'ha-sidebar')) {
    if (sidebar.shadowRoot && !sidebar.shadowRoot.querySelector('[data-civica-sidebar]')) {
      const style = document.createElement('style'); style.dataset.civicaSidebar = '';
      style.textContent = '.menu { --wa-focus-ring-color: var(--ha-color-focus); } .menu ha-icon-button { color: var(--sidebar-menu-button-text-color); }';
      sidebar.shadowRoot.append(style); sidebarStyles.add(style);
    }
    const title = sidebar.shadowRoot?.querySelector<HTMLElement>('.title');
    if (!title) continue;
    let logo = title.querySelector<HTMLImageElement>('img[data-civica-logo]');
    if (!logo) {
      if (!originalTitles.has(title)) originalTitles.set(title, Array.from(title.childNodes));
      logo = document.createElement('img'); logo.dataset.civicaLogo = ''; logo.alt = 'civica.uk';
      logo.style.cssText = 'display:block;width:100%;max-width:176px;height:auto;box-sizing:border-box;padding:5px 8px;';
      title.replaceChildren(logo);
    }
    const logoUrl = new URL(`${variantPath}lockup-on-primary.svg`, assetBase).href;
    if (logo.src !== logoUrl) logo.src = logoUrl;
  }
  const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]');
  if (!icons.length && !ownIcon) { ownIcon = document.createElement('link'); ownIcon.rel = 'icon'; document.head.append(ownIcon); }
  for (const icon of [...icons, ...(ownIcon ? [ownIcon] : [])]) {
    if (!originalIcons.has(icon) && icon !== ownIcon) originalIcons.set(icon, Object.fromEntries(['href', 'type', 'sizes'].map(name => [name, icon.getAttribute(name)])));
    const touchIcon = icon.rel === 'apple-touch-icon';
    const target = `${variantPath}app-icon.${touchIcon ? 'png' : 'svg'}`;
    const href = new URL(target, assetBase).href;
    if (icon.href !== href) icon.href = href;
    icon.type = touchIcon ? 'image/png' : 'image/svg+xml';
    icon.sizes.value = touchIcon ? '512x512' : 'any';
  }
}

export function enhance() {
  const app = document.querySelector<App>('home-assistant');
  if (!app?.hass || !app.shadowRoot) return;
  // Query only on startup/navigation/theme changes, with bounded retries for
  // lazy-rendered roots. Never observe state updates across the whole app.
  const targets = findAll(app.shadowRoot, 'ha-pick-theme-row,ha-sidebar,hass-subpage,ha-top-app-bar-fixed');
  for (const row of targets.filter(el => el.localName === 'ha-pick-theme-row')) {
    const root = row.shadowRoot;
    const native = root?.querySelector('ha-theme-settings');
    if (!root || !native) continue;
    let control = root.querySelector<CivicaThemeSettings>('civica-theme-settings');
    if (!control) { control = document.createElement('civica-theme-settings') as CivicaThemeSettings; native.after(control); }
    control.hass = app.hass;
  }
  updateBrand(app, targets);
}
function tick() { enhance(); if (--remaining > 0) queued = setTimeout(tick, 500); else queued = undefined; }
function schedule() { remaining = 12; clearTimeout(queued); queued = setTimeout(tick, 0); }

const runtime = window as unknown as { __civicaUiInstalled?: boolean };
if (!runtime.__civicaUiInstalled) {
  runtime.__civicaUiInstalled = true;
  for (const event of ['location-changed', 'popstate', 'settheme']) window.addEventListener(event, schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  customElements.whenDefined('ha-pick-theme-row').then(schedule);
  customElements.whenDefined('ha-sidebar').then(schedule);
  // HA applies cross-device theme changes to the document's inline variables.
  // Observe only that attribute; coalesce without repeating startup retries.
  let themeTick: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => { clearTimeout(themeTick); themeTick = setTimeout(enhance, 100); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  schedule();
}
