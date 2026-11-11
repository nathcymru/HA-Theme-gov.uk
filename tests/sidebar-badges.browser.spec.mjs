import { test, expect } from '@playwright/test';
import { buildSync } from 'esbuild';
import themes from '../design-system/themes.json' with { type: 'json' };

// Exercise the adapter against HA's actual two-slot count structure and adopted
// style precedence (frontend e32bc069), without touching notification services.
const moduleSource = buildSync({ entryPoints: ['ui/src/sidebar-badges.ts'], bundle: true, format: 'esm', target: 'es2022', write: false }).outputFiles[0].text;
const theme = themes.themes['civica Civic Cobalt Vivid'];
const applyMode = async (page, dark = false) => page.evaluate(({ common, mode }) => {
  for (const [key, value] of Object.entries({ ...common, ...mode })) {
    if (typeof value === 'string' || typeof value === 'number') document.documentElement.style.setProperty(`--${key}`, String(value));
  }
}, { common: theme, mode: theme.modes[dark ? 'dark' : 'light'] });

test.beforeEach(async ({ page }) => {
  await page.route('**/__badge-audit__/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Sidebar badge fixture</title></head><body style="font:16px Arial,sans-serif"></body></html>' }));
  await page.route('**/__badge-audit__/module.js', route => route.fulfill({ contentType: 'application/javascript', body: moduleSource }));
  await page.goto('/__badge-audit__/');
  await applyMode(page);
  await page.evaluate(async () => {
    const tracked = [];
    const NativeObserver = MutationObserver;
    window.MutationObserver = class extends NativeObserver {
      constructor(callback) {
        const record = { calls: 0, active: false };
        super((...args) => { record.calls++; callback(...args); });
        this.record = record; tracked.push(record);
      }
      observe(...args) { this.record.active = true; super.observe(...args); }
      disconnect() { this.record.active = false; super.disconnect(); }
    };
    const sheet = css => { const value = new CSSStyleSheet(); value.replaceSync(css); return value; };
    customElements.define('ha-list-item-button', class extends HTMLElement {
      constructor() {
        super(); const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = '<button type="button"><slot name="start"></slot><slot name="headline"></slot><slot name="end"></slot></button>';
        root.adoptedStyleSheets = [sheet('button { display:flex; position:relative; align-items:center; gap:8px; min-height:48px; width:100%; padding:8px; border:0; color:inherit; background:transparent; font:inherit; text-align:left; }')];
      }
    });
    customElements.define('ha-sidebar', class extends HTMLElement {
      constructor() {
        super(); const root = this.attachShadow({ mode: 'open' });
        root.adoptedStyleSheets = [sheet(`
          :host { display:block; width:250px; color:var(--sidebar-text-color); background:var(--sidebar-background-color); }
          ha-list-item-button { display:block; }
          ha-list-item-button .item-text { display:block; max-width:0; opacity:0; overflow:hidden; white-space:nowrap; }
          :host([expanded]) ha-list-item-button .item-text { max-width:100%; opacity:1; }
          .badge { display:flex; justify-content:center; align-items:center; min-width:8px; border-radius:12px; font-weight:400; line-height:normal; background:var(--accent-color); padding:2px 6px; color:var(--text-primary-color); }
          ha-svg-icon + .badge { position:absolute; top:4px; left:26px; border-radius:4px; font-size:.65em; line-height:1.6; padding:0 4px; }
          :host([expanded]) .badge[slot="start"], :host(:not([expanded])) .badge[slot="end"] { opacity:0; transform:scale(.8); pointer-events:none; }
        `)];
        root.innerHTML = '<ha-list-item-button id="sidebar-notifications"><ha-svg-icon slot="start" aria-hidden="true">●</ha-svg-icon><span class="badge" slot="start">1</span><span class="item-text" slot="headline">Notifications</span><span class="badge" slot="end" aria-hidden="false">1</span></ha-list-item-button>';
      }
    });
    const api = await import('/__badge-audit__/module.js');
    const sidebar = document.createElement('ha-sidebar'); sidebar.setAttribute('expanded', ''); document.body.append(sidebar);
    const root = sidebar.shadowRoot;
    const style = document.createElement('style'); style.textContent = api.badgeStyles; root.append(style);
    const originalNodes = [...root.querySelectorAll('.badge')].map(b => b.firstChild);
    const activate = () => { if (!style.isConnected) root.append(style); api.updateBadges(root); };
    const deactivate = () => { api.updateBadges(undefined, false); style.remove(); };
    const setCount = value => originalNodes.forEach(node => { node.data = String(value); });
    activate();
    window.badgeFixture = { api, sidebar, root, style, originalNodes, tracked, activate, deactivate, setCount };
  });
});

test('MOJ counts update in place, retain Lit text nodes and are named once in both sidebar states', async ({ page }) => {
  const button = page.locator('ha-list-item-button button');
  for (const expanded of [true, false]) {
    await page.evaluate(expanded => window.badgeFixture.sidebar.toggleAttribute('expanded', expanded), expanded);
    for (const count of [0, 1, 98, 99, 100, 1000]) {
      await page.evaluate(count => window.badgeFixture.setCount(count), count);
      const description = count ? ` (${count >= 99 ? '99 or more' : count} ${count === 1 ? 'item needs' : 'items need'} attention)` : '';
      await expect(button).toHaveAccessibleName(`Notifications${description}`);
      await expect(page.locator('.civica-count-description')).toHaveCount(count ? 1 : 0);
      const visible = page.locator(`.badge[slot="${expanded ? 'end' : 'start'}"]`);
      await expect(visible).toHaveAttribute('data-civica-count', count ? count >= 99 ? '99+' : String(count) : '');
      if (count) {
        await expect(visible).toBeVisible();
        expect(await visible.evaluate(el => getComputedStyle(el, '::after').content)).toBe(`"${count >= 99 ? '99+' : count}"`);
      } else await expect(visible).toBeHidden();
      await expect(page.locator(`.badge[slot="${expanded ? 'start' : 'end'}"]`)).toBeHidden();
      expect(await page.evaluate(() => window.badgeFixture.originalNodes.every((node, i) => node === window.badgeFixture.root.querySelectorAll('.badge')[i].firstChild))).toBe(true);
      await expect(page.locator('.badge').first()).toHaveText(String(count));
    }
  }
});

test('relative MOJ geometry remains rounded and scales with text without changing its semantic colours', async ({ page }) => {
  const badge = page.locator('.badge[slot="end"]');
  for (const scale of [1, 2]) {
    await page.evaluate(scale => document.documentElement.style.setProperty('--ha-font-size-scale', scale), scale);
    const geometry = await badge.evaluate(el => {
      const outer = getComputedStyle(el), count = getComputedStyle(el, '::after');
      return { radius: outer.borderRadius, padding: outer.padding, margin: outer.marginLeft, outline: outer.outlineWidth, offset: outer.outlineOffset, font: count.fontSize, weight: count.fontWeight, minimumWidth: count.minWidth, minimumHeight: count.minHeight, lineHeight: count.lineHeight, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
    });
    // Browsers expose a rounded used outline offset. Compare with the original
    // MOJ em declaration at the visible font size, not a fractional assumption.
    const sourceOffset = await page.evaluate(size => {
      const reference = document.createElement('span');
      reference.style.cssText = `font-size:${size}px;outline-offset:-.1em`;
      document.body.append(reference);
      const offset = getComputedStyle(reference).outlineOffset;
      reference.remove(); return offset;
    }, 16 * scale);
    expect(geometry).toMatchObject({ radius: `${160 * scale}px`, padding: `1px ${4 * scale}px 0px`, margin: `${8 * scale}px`, outline: '4px', offset: sourceOffset, font: `${16 * scale}px`, weight: '700', minimumWidth: `${12 * scale}px`, minimumHeight: `${20 * scale}px`, lineHeight: `${20 * scale}px` });
    expect(geometry.width).toBeGreaterThanOrEqual(20 * scale);
    expect(geometry.height).toBe(20 * scale + 1);
  }
  await page.evaluate(() => document.documentElement.style.setProperty('--ha-font-size-scale', '1'));
  for (const dark of [false, true]) {
    await applyMode(page, dark);
    await expect(badge).toHaveCSS('background-color', 'rgb(202, 53, 53)');
    await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
    const contrast = await badge.evaluate(el => {
      const luminance = rgb => {
        const values = rgb.match(/[\d.]+/g).slice(0, 3).map(x => { const n = Number(x) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      };
      const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const fill = luminance(getComputedStyle(el).backgroundColor);
      return { text: ratio(fill, luminance(getComputedStyle(el).color)), boundary: ratio(fill, luminance(getComputedStyle(window.badgeFixture.sidebar).backgroundColor)) };
    });
    expect(contrast.text).toBeGreaterThanOrEqual(4.5);
    expect(contrast.boundary).toBeGreaterThanOrEqual(3);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(badge).toHaveCSS('outline-style', 'solid');
  expect(await badge.evaluate(el => getComputedStyle(el).outlineColor !== getComputedStyle(el).backgroundColor)).toBe(true);
});

test('activation is idempotent and default-theme restoration disconnects observers and restores attributes', async ({ page }) => {
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.badgeFixture.activate(); });
  expect(await page.evaluate(() => window.badgeFixture.tracked.filter(record => record.active).length)).toBe(1);
  await expect(page.locator('.civica-count-description')).toHaveCount(1);
  await page.evaluate(() => window.badgeFixture.deactivate());
  await expect(page.locator('[data-civica-count],.civica-count-description')).toHaveCount(0);
  await expect(page.locator('.badge[slot="start"]')).not.toHaveAttribute('aria-hidden');
  await expect(page.locator('.badge[slot="end"]')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.badge[slot="end"]')).toHaveCSS('border-radius', '12px');
  const callbacks = await page.evaluate(() => window.badgeFixture.tracked.reduce((sum, record) => sum + record.calls, 0));
  await page.evaluate(async () => { window.badgeFixture.setCount(1000); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  expect(await page.evaluate(() => window.badgeFixture.tracked.reduce((sum, record) => sum + record.calls, 0))).toBe(callbacks);
  expect(await page.evaluate(() => window.badgeFixture.tracked.some(record => record.active))).toBe(false);
  await page.evaluate(() => window.badgeFixture.activate());
  await expect(page.locator('.badge[slot="end"]')).toHaveAttribute('data-civica-count', '99+');
  expect(await page.evaluate(() => window.badgeFixture.tracked.filter(record => record.active).length)).toBe(1);
  await page.evaluate(() => { window.badgeFixture.sidebar.remove(); window.badgeFixture.api.updateBadges(); });
  expect(await page.evaluate(() => window.badgeFixture.tracked.some(record => record.active))).toBe(false);
  expect(await page.evaluate(() => window.badgeFixture.root.querySelectorAll('[data-civica-count],.civica-count-description').length)).toBe(0);
});

test('nonnumeric indicators and removed native nodes never retain a stale fabricated count', async ({ page }) => {
  await page.evaluate(() => window.badgeFixture.setCount('●'));
  await expect(page.locator('[data-civica-count],.civica-count-description')).toHaveCount(0);
  await expect(page.locator('.badge[slot="start"]')).not.toHaveAttribute('aria-hidden');
  await page.evaluate(() => window.badgeFixture.setCount(8));
  await expect(page.locator('.badge[slot="end"]')).toHaveAttribute('data-civica-count', '8');
  await page.evaluate(() => {
    const fixture = window.badgeFixture;
    fixture.removed = [...fixture.root.querySelectorAll('.badge')];
    fixture.removed.forEach(badge => badge.remove());
  });
  await expect(page.locator('.civica-count-description')).toHaveCount(0);
  expect(await page.evaluate(() => window.badgeFixture.removed.map(badge => ({ count: badge.getAttribute('data-civica-count'), hidden: badge.getAttribute('aria-hidden') })))).toEqual([{ count: null, hidden: null }, { count: null, hidden: 'false' }]);
});
