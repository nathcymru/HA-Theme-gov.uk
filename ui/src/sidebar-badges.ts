// MOJ notification badge, adapted to HA's two responsive copies of a count.
// Keep HA's text nodes intact: Lit continues to own the live count and routing.
const states = new Map<ShadowRoot, { observer: MutationObserver; originals: Map<HTMLElement, string | null> }>();
export const badgeStyles = `
ha-list-item-button .badge[data-civica-count] {
  background:var(--civica-notification-badge-background,#ca3535);
  color:var(--civica-notification-badge-color,#fff);
  /* The source text has zero size. Resolve MOJ's em geometry against the
     visible count font, otherwise 10em becomes a square zero-pixel radius. */
  border-radius:calc(var(--civica-notification-badge-font-size,16px) * 10);
  font-size:0; line-height:0; font-weight:700;
  min-width:0; min-height:0;
  padding:1px calc(var(--civica-notification-badge-font-size,16px) * .25) 0;
  margin-left:calc(var(--civica-notification-badge-font-size,16px) * .5);
  outline:var(--civica-notification-badge-outline,4px solid #ca3535);
  /* The outline offset must use the visible font size, not the hidden source. */
  outline-offset:calc(var(--civica-notification-badge-font-size,16px) * -.1);
  text-align:center; box-sizing:content-box;
}
ha-list-item-button .badge[data-civica-count]::after {
  content:attr(data-civica-count); display:inline-block;
  font-size:var(--civica-notification-badge-font-size,16px);
  font-weight:var(--civica-notification-badge-font-weight,700);
  line-height:var(--civica-notification-badge-line-height,1.25);
  min-width:var(--civica-notification-badge-min-width,.75em);
  min-height:var(--civica-notification-badge-min-height,1.25em);
}
ha-list-item-button .badge[data-civica-count=""] { display:none; }
:host([expanded]) ha-list-item-button .badge[slot="start"],
:host(:not([expanded])) ha-list-item-button .badge[slot="end"] { display:none; }
:host(:not([expanded])) ha-list-item-button .badge[slot="start"] { left:22px; top:0; margin-left:0; }
.civica-count-description { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
@media(forced-colors:active) { ha-list-item-button .badge[data-civica-count] { background:Canvas; color:CanvasText; outline-color:CanvasText; } }
`;

export function updateBadges(root?: ShadowRoot, active = true) {
  const restore = (badge: HTMLElement, original: string | null) => {
    badge.removeAttribute('data-civica-count');
    if (original === null) badge.removeAttribute('aria-hidden'); else badge.setAttribute('aria-hidden', original);
  };
  for (const [oldRoot, state] of states) {
    if (active && oldRoot.host.isConnected) continue;
    state.observer.disconnect();
    for (const [badge, original] of state.originals) {
      restore(badge, original);
    }
    oldRoot.querySelectorAll('.civica-count-description').forEach(node => node.remove());
    states.delete(oldRoot);
  }
  if (!active || !root || states.has(root)) return;
  const originals = new Map<HTMLElement, string | null>();
  const sync = () => {
    for (const [badge, original] of originals) {
      if (!badge.isConnected || !root.contains(badge) || !/^\d+\+?$/.test(badge.textContent?.trim() || '')) {
        restore(badge, original);
        originals.delete(badge);
      }
    }
    for (const item of root.querySelectorAll<HTMLElement>('ha-list-item-button')) {
      const badges = [...item.querySelectorAll<HTMLElement>('.badge')];
      const source = badges.map(el => el.textContent?.trim() || '').find(text => /^\d+\+?$/.test(text));
      const count = source ? Number.parseInt(source, 10) : 0;
      // A dot indicator without a count remains native; never invent a number.
      for (const badge of badges) {
        if (!/^\d+\+?$/.test(badge.textContent?.trim() || '')) continue;
        if (!originals.has(badge)) originals.set(badge, badge.getAttribute('aria-hidden'));
        const display = count <= 0 ? '' : count >= 99 ? '99+' : String(count);
        if (badge.dataset.civicaCount !== display) badge.dataset.civicaCount = display;
        if (badge.getAttribute('aria-hidden') !== 'true') badge.setAttribute('aria-hidden', 'true');
      }
      const headline = item.querySelector('.item-text');
      let description = item.querySelector<HTMLElement>('.civica-count-description');
      if (!count || !headline) { description?.remove(); continue; }
      if (!description) { description = document.createElement('span'); description.className = 'civica-count-description'; headline.append(description); }
      const text = ` (${count >= 99 ? '99 or more' : count} ${count === 1 ? 'item needs' : 'items need'} attention)`;
      if (description.textContent !== text) description.textContent = text;
    }
  };
  const observer = new MutationObserver(sync);
  states.set(root, { observer, originals });
  sync();
  observer.observe(root, { subtree:true, childList:true, characterData:true });
}
