// A bounded, optional adapter for the native light dialog. All native controls,
// keyboard handling, orientation and scrolling remain owned by Home Assistant.
// If its structure changes, leave the native dialog working without enhancement.
export interface DialogScene { id: string; label: string; icon: string; fill: (swatch: HTMLElement) => void; pressed: boolean }
export interface DialogSpec { entityId: string; title: string; scenes: DialogScene[]; onPick: (id: string) => Promise<boolean> }

const SCENES_CSS = `
.civica-scenes { margin-block: 30px 20px; color: var(--primary-text-color); font: var(--civica-font-size-body, 19px)/1.5 var(--ha-font-family-body, Arial, sans-serif); }
.civica-scenes h3 { margin: 0 0 15px; font: inherit; font-weight: 700; }
.civica-scenes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 15px; }
.civica-scenes li { min-width: 0; max-width: 100%; }
.civica-scene { display: flex; align-items: center; gap: 10px; position: relative; min-width: 44px; min-height: 44px; max-width: 100%; box-sizing: border-box; padding: 8px 10px 11px; cursor: pointer; background: var(--secondary-background-color); color: var(--primary-text-color); border: 2px solid transparent; border-radius: 0; box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); font: inherit; line-height: 1.3; text-align: start; overflow-wrap: anywhere; }
.civica-scene:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.civica-scene:active { top: 2px; }
.civica-scene:disabled { cursor: wait; opacity: .65; }
.civica-scene:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
.civica-scene-icon { flex: 0 0 24px; width: 24px; height: 24px; --mdc-icon-size: 24px; color: inherit; pointer-events: none; }
/* Scene colours describe the lights, not the icon or action. Keep labels and
   monochrome Home Assistant icons readable throughout the preview animation. */
.civica-swatch { position: absolute; inset-inline: 0; bottom: 0; height: 3px; display: block; pointer-events: none; }
.civica-scene:focus-visible .civica-swatch { visibility: hidden; }
.civica-scene-status { margin: 15px 0 0; }
.civica-scene-status:empty { display: none; }
@media (forced-colors: active) { .civica-scene { border-color: ButtonText; } .civica-scene:focus-visible { outline-color: Highlight; } .civica-swatch { display: none; } }
`;

interface LightControl extends HTMLElement { stateObj?: { entity_id?: string } }
function findDeep(root: ParentNode, selector: string): HTMLElement | null {
  const hit = root.querySelector<HTMLElement>(selector); if (hit) return hit;
  for (const e of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (e.shadowRoot) { const found = findDeep(e.shadowRoot, selector); if (found) return found; }
  }
  return null;
}
let cancelPending: (() => void) | undefined;

/** Decorates only the requested entity. Cancels stale requests and cleans up on close. */
export function tuneMoreInfo(spec: DialogSpec): () => void {
  cancelPending?.();
  const started = performance.now();
  let cancelled = false, frame = 0;
  let cleanup: (() => void) | undefined;
  const cancel = () => { cancelled = true; cancelAnimationFrame(frame); cleanup?.(); cleanup = undefined; };
  cancelPending = cancel;
  const tick = () => {
    if (cancelled) return;
    const ha = document.querySelector('home-assistant');
    const dlg = ha?.shadowRoot ? findDeep(ha.shadowRoot, 'ha-more-info-dialog') : null;
    const control = (dlg?.shadowRoot ? findDeep(dlg.shadowRoot, 'more-info-light') : null) as LightControl | null;
    const root = control?.shadowRoot;
    // stateObj is the native light component's public property. Never attach a
    // previous room's scene actions to a different entity or to an unknown host.
    if (dlg && control && root && control.stateObj?.entity_id === spec.entityId && root.querySelector('.controls')) {
      if (!spec.scenes.length) return;
      const style = document.createElement('style'); style.textContent = SCENES_CSS;
      const section = document.createElement('section'); section.className = 'civica-scenes';
      section.setAttribute('aria-label', `Scenes for ${spec.title}`);
      const heading = document.createElement('h3'); heading.textContent = `Scenes for ${spec.title}`;
      const list = document.createElement('ul');
      const status = document.createElement('p'); status.className = 'civica-scene-status'; status.setAttribute('role', 'status');
      for (const scene of spec.scenes) {
        const item = document.createElement('li');
        const button = document.createElement('button'); button.type = 'button'; button.className = 'civica-scene';
        const icon = document.createElement('ha-icon'); icon.className = 'civica-scene-icon'; icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('icon', scene.icon);
        const swatch = document.createElement('span'); swatch.className = 'civica-swatch'; swatch.setAttribute('aria-hidden', 'true'); scene.fill(swatch);
        const label = document.createElement('span'); label.textContent = scene.label;
        button.append(icon, label, swatch);
        button.addEventListener('click', async () => {
          if (cancelled || control.stateObj?.entity_id !== spec.entityId) return;
          const buttons = Array.from(section.querySelectorAll('button'));
          for (const b of buttons) b.disabled = true;
          status.textContent = '';
          try {
            const accepted = await spec.onPick(scene.id);
            if (!cancelled && accepted) status.textContent = `${scene.label} requested. Check the lights to confirm the change.`;
          } catch {
            if (!cancelled) status.textContent = `${scene.label} could not be applied. Try again.`;
          } finally { for (const b of buttons) b.disabled = false; }
        });
        item.append(button); list.append(item);
      }
      section.append(heading, list, status);
      root.append(style); root.querySelector('.controls')!.after(section);
      // Native controls may be reused when the user opens a group member.
      const observer = new MutationObserver(() => {
        if (!control.isConnected || control.stateObj?.entity_id !== spec.entityId) cancel();
      });
      observer.observe(root, { childList: true, subtree: true });
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const reduceMotion = () => { if (motion.matches) section.getAnimations({ subtree: true }).forEach((a) => a.cancel()); };
      motion.addEventListener('change', reduceMotion);
      const closed = () => cancel();
      dlg.addEventListener('dialog-closed', closed);
      dlg.addEventListener('closed', closed);
      cleanup = () => {
        observer.disconnect(); motion.removeEventListener('change', reduceMotion); style.remove(); section.getAnimations({ subtree: true }).forEach((a) => a.cancel()); section.remove();
        dlg.removeEventListener('dialog-closed', closed); dlg.removeEventListener('closed', closed);
      };
      return;
    }
    if (performance.now() - started < 6000) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return cancel;
}
