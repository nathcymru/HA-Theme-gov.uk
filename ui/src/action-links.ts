interface ActionLink { name: string; path: string }
interface ActionLinksConfig { links: ActionLink[] }

// Keep real browser links: HA's private navigate() helper also owns dialog and
// unsaved-change guards. Reimplementing only its pushState/event pair would
// bypass those guards. Native links preserve history, modifier keys and the
// hashchange event used by dashboard pop-ups without an internal API dependency.
function readConfig(value: unknown): ActionLinksConfig {
  const links = (value as Partial<ActionLinksConfig> | null)?.links;
  if (!Array.isArray(links) || !links.length) throw new Error('Add at least one link with a name and a local path.');
  return { links: links.map((link, index) => {
    if (!link || typeof link.name !== 'string' || !link.name.trim()) throw new Error(`Link ${index + 1} needs a name.`);
    const path = link.path;
    // No schemes, protocol-relative addresses, backslashes or whitespace that
    // URL parsing could silently normalise into a different destination.
    if (typeof path !== 'string' || /[\s\\\u0000-\u001f\u007f]/.test(path)
      || !(path.startsWith('/') && !path.startsWith('//') || path.startsWith('#') && path.length > 1)) {
      throw new Error(`Link ${index + 1} needs a local path beginning with / or a fragment beginning with #.`);
    }
    const destination = new URL(path, location.href);
    if (destination.origin !== location.origin) throw new Error(`Link ${index + 1} must stay on this Home Assistant site.`);
    return { name: link.name.trim(), path };
  }) };
}

const CSS = `
:host { display:block; font:700 var(--civica-font-size-body,19px)/1.3 var(--ha-font-family-body,Arial,sans-serif); }
* { box-sizing:border-box; }
ul { display:flex; flex-wrap:wrap; gap:12px 32px; list-style:none; padding:0; margin:0; }
li { min-width:0; max-width:100%; }
a, a:visited { display:flex; align-items:center; gap:12px; min-height:44px; max-width:100%; padding:2px 0; color:var(--link-color,#1d70b8); text-decoration:none; }
.label { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:.16em; overflow-wrap:anywhere; }
.circle { display:flex; align-items:center; justify-content:center; flex:0 0 40px; width:40px; height:40px; border-radius:50%; color:var(--primary-text-color,#0b0c0c); background:color-mix(in srgb, var(--civica-brand-primary,#1d70b8) 20%, var(--card-background-color,#fff)); }
svg { display:block; width:24px; height:24px; }
a:hover, a:active { color:var(--civica-action-hover,#15558c); }
a:hover .label, a:active .label { text-decoration-thickness:3px; }
a:focus-visible { color:var(--civica-focus-text,#0b0c0c); background:var(--civica-focus-background,#ffdd00); outline:3px solid var(--civica-focus-background,#ffdd00); box-shadow:0 3px 0 var(--civica-focus-text,#0b0c0c); }
a:focus-visible .label { text-decoration:none; }
a:focus-visible .circle { color:var(--civica-focus-background,#ffdd00); background:var(--civica-focus-text,#0b0c0c); }
@media (forced-colors:active) {
  a, a:visited, a:hover { color:LinkText; }
  .circle, a:focus-visible .circle { color:LinkText; background:Canvas; border:1px solid LinkText; }
  a:focus-visible { color:LinkText; background:Canvas; outline-color:Highlight; box-shadow:none; }
}
`;

export class CivicaActionLinks extends HTMLElement {
  private links: ActionLink[] = [];
  private list: HTMLUListElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = CSS;
    this.list = document.createElement('ul');
    // Safari otherwise removes list semantics when list-style is none.
    this.list.setAttribute('role', 'list');
    root.append(style, this.list);
  }

  public setConfig(value: unknown) {
    const config = readConfig(value);
    this.links = config.links;
    this.list.replaceChildren(...this.links.map(({ name, path }) => {
      const item = document.createElement('li');
      const link = document.createElement('a'); link.setAttribute('href', path);
      const circle = document.createElement('span'); circle.className = 'circle'; circle.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('focusable', 'false');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', 'M5 12h14m-6-6 6 6-6 6');
      arrow.setAttribute('fill', 'none'); arrow.setAttribute('stroke', 'currentColor'); arrow.setAttribute('stroke-width', '2');
      svg.append(arrow); circle.append(svg);
      const label = document.createElement('span'); label.className = 'label'; label.textContent = name;
      link.append(circle, label); item.append(link); return item;
    }));
  }

  public getCardSize() { return Math.max(1, Math.ceil(this.links.length / 2)); }
}

if (!customElements.get('civica-action-links')) customElements.define('civica-action-links', CivicaActionLinks);
const registry = window as unknown as { customCards?: { type: string; name: string; description: string }[] };
registry.customCards ||= [];
if (!registry.customCards.some(card => card.type === 'civica-action-links')) registry.customCards.push({
  type: 'civica-action-links', name: 'civica.uk action links', description: 'Clear, labelled links to Home Assistant pages and dashboard pop-ups.',
});
