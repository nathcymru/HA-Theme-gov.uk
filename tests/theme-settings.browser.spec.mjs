import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import palettes from '../design-system/palettes.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.goto('/ui/dev/');
  await expect(page.getByLabel('Colour palette')).toBeEnabled();
});

test('all palettes and both tones select installed themes and preserve dark mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Use dark mode', exact: true }).click();
  for (const palette of palettes.palettes) {
    await page.getByLabel('Colour palette').selectOption(palette.id);
    for (const muted of [true, false]) {
      await page.getByRole('switch', { name: 'Use muted colours' }).setChecked(muted);
      await expect.poll(() => page.evaluate(() => window.fixture.app.hass.selectedTheme)).toEqual({ theme: `civica ${palette.name} ${muted ? 'Muted' : 'Vivid'}`, dark: true });
      const detail = await page.evaluate(() => { const event = window.events.at(-1); return { overrideReset: Object.hasOwn(event, 'primaryColor') && event.primaryColor === undefined && Object.hasOwn(event, 'accentColor') && event.accentColor === undefined, changesMode: Object.hasOwn(event, 'dark') }; });
      expect(detail).toEqual({ overrideReset: true, changesMode: false });
    }
  }
});

test('keyboard switch, accessible names and 320px reflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const select = page.getByLabel('Colour palette'); await select.focus();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('14px');
  expect(await select.evaluate(el => getComputedStyle(el).fontSize)).toBe('19px');
  expect(await page.locator('civica-theme-settings h2').evaluate(el => getComputedStyle(el).fontSize)).toBe('24px');
  await page.keyboard.press('Tab'); await expect(page.getByRole('switch')).toBeFocused();
  await page.keyboard.press('Space'); await expect(page.getByRole('switch')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include('civica-theme-settings').analyze();
  expect(results.violations).toEqual([]);
});

test('external native theme changes synchronise and missing themes disable the controls', async ({ page }) => {
  await page.evaluate(() => {
    window.fixture.app.hass.selectedTheme = { theme: 'civica Racing Moss Muted' };
    window.fixture.paint();
  });
  await expect(page.getByLabel('Colour palette')).toHaveValue('racing-moss');
  await expect(page.getByRole('switch')).toBeChecked();
  await page.evaluate(() => {
    delete window.fixture.app.hass.themes.themes['civica Racing Moss Muted'];
    document.querySelector('civica-theme-settings').hass = window.fixture.app.hass;
  });
  await expect(page.getByLabel('Colour palette')).toBeDisabled();
  await expect(page.getByRole('switch')).toBeDisabled();
  await expect(page.getByRole('status').first()).toContainText('Install all');
});

test('profile adapter mounts once, preserves native controls and restores branding', async ({ page }) => {
  await page.evaluate(async () => {
    class ProfileRow extends HTMLElement { constructor() { super(); this.attachShadow({mode:'open'}).append(document.createElement('ha-theme-settings')); } }
    class Sidebar extends HTMLElement { constructor() { super(); const title = document.createElement('div'); title.className='title'; title.textContent='Home Assistant'; this.attachShadow({mode:'open'}).append(title); } }
    customElements.define('ha-pick-theme-row',ProfileRow); customElements.define('ha-sidebar',Sidebar);
    const app=window.fixture.app;
    app.shadowRoot.append(document.createElement('ha-pick-theme-row'),document.createElement('ha-sidebar'));
    window.dispatchEvent(new Event('location-changed'));
  });
  const profile = page.locator('ha-pick-theme-row');
  await expect(profile.locator('civica-theme-settings')).toHaveCount(1);
  await expect(profile.locator('ha-theme-settings')).toHaveCount(1);
  await expect(page.locator('ha-sidebar img')).toHaveAttribute('alt', 'civica');
  // Resource cache-busting can accidentally load a second URL in a session.
  await page.evaluate(async () => { await import('/ui/dist/civica-ui.js?duplicate-resource'); });
  await page.evaluate(() => window.dispatchEvent(new Event('location-changed')));
  await expect(profile.locator('civica-theme-settings')).toHaveCount(1);
  await page.evaluate(() => { window.fixture.app.hass.selectedTheme.theme='default'; window.fixture.app.hass.themes.theme='default'; window.dispatchEvent(new Event('settheme')); });
  await expect(page.locator('ha-sidebar .title')).toHaveText('Home Assistant');
  await expect(page.locator('ha-sidebar [data-civica-sidebar]')).toHaveCount(0);
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', '../../brand/civica/icons/favicon.ico');
});

test('default theme can select Cobalt and recovery mode retains native identity', async ({ page }) => {
  await page.evaluate(() => {
    const { app } = window.fixture; app.hass.themes.theme = 'default'; app.hass.selectedTheme.theme = 'default';
    document.querySelector('civica-theme-settings').hass = app.hass;
  });
  await expect(page.getByLabel('Colour palette')).toHaveValue('');
  await expect(page.getByRole('switch')).toBeDisabled();
  await page.getByLabel('Colour palette').selectOption('civic-cobalt');
  await expect(page.getByRole('switch')).toBeEnabled();
  await page.evaluate(() => {
    const { app } = window.fixture; app.hass.config = { recovery_mode: true }; app.hass.themes.theme = 'default';
    document.querySelector('civica-theme-settings').hass = app.hass;
    window.dispatchEvent(new Event('location-changed'));
  });
  await expect(page.getByLabel('Colour palette')).toBeDisabled();
  await expect(page.getByRole('status').first()).toContainText('recovery mode');
  await expect.poll(() => page.locator('head link[rel="icon"]').getAttribute('href')).toBe('../../brand/civica/icons/favicon.ico');
});

test('all palette contexts pass automated text contrast checks', async ({ page }) => {
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Use dark mode', exact: true }).click();
    for (const palette of palettes.palettes) {
      await page.getByLabel('Colour palette').selectOption(palette.id);
      for (const muted of [true, false]) {
        await page.getByRole('switch').setChecked(muted);
        const results = await new AxeBuilder({ page }).include('civica-theme-settings').withRules(['color-contrast']).analyze();
        expect(results.violations, `${palette.name} ${muted} ${dark}`).toEqual([]);
      }
    }
  }
});

test('supplied v3.2 logos and app icons follow every palette and tone in both display modes', async ({ page }) => {
  // Set up original metadata while the adapter is inactive, independent of
  // whether its first scheduled pass has already run on this machine.
  await page.evaluate(() => {
    window.fixture.app.hass.selectedTheme.theme = window.fixture.app.hass.themes.theme = 'default';
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', '../../brand/civica/icons/favicon.ico');
  const originals = await page.evaluate(() => {
    class Sidebar extends HTMLElement {
      constructor() {
        super();
        const menu = document.createElement('div'); menu.className = 'menu';
        const title = document.createElement('div'); title.className = 'title'; title.textContent = 'Home Assistant';
        menu.append(title); this.attachShadow({ mode: 'open' }).append(menu);
      }
    }
    customElements.define('ha-sidebar', Sidebar);
    const icon = document.querySelector('head link[rel="icon"]');
    icon.setAttribute('type', 'image/x-icon'); icon.setAttribute('sizes', '16x16 32x32');
    const touch = document.createElement('link'); touch.rel = 'apple-touch-icon';
    touch.href = '/original-touch.png'; touch.type = 'image/png'; touch.sizes.value = '180x180';
    document.head.append(touch);
    const attributes = [icon, touch].map(el => Object.fromEntries(['href', 'type', 'sizes'].map(name => [name, el.getAttribute(name)])));
    window.fixture.app.shadowRoot.append(document.createElement('ha-sidebar'));
    window.fixture.app.hass.selectedTheme.theme = window.fixture.app.hass.themes.theme = 'civica Civic Cobalt Vivid';
    window.dispatchEvent(new Event('location-changed'));
    return attributes;
  });
  const logo = page.locator('ha-sidebar img[data-civica-logo]');
  await expect(logo).toHaveCount(1);
  await logo.evaluate(el => el.dataset.identity = 'preserve-this-node');
  const favicon = page.locator('head link[rel="icon"]');
  const touch = page.locator('head link[rel="apple-touch-icon"]');
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Use dark mode', exact: true }).click();
    for (const palette of palettes.palettes) {
      await page.getByLabel('Colour palette').selectOption(palette.id);
      for (const muted of [false, true]) {
        await page.getByRole('switch').setChecked(muted);
        const stem = `/ui/dist/brand/themes/${palette.id}/${muted ? 'muted' : 'vivid'}/`;
        await expect(logo).toHaveAttribute('src', new RegExp(`${stem}lockup-on-primary\\.svg\\?v=1\\.4\\.0$`));
        await expect(logo).toHaveAttribute('data-identity', 'preserve-this-node');
        await expect.poll(() => logo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
        await expect(favicon).toHaveAttribute('href', new RegExp(`${stem}app-icon\\.svg\\?v=1\\.4\\.0$`));
        await expect(favicon).toHaveAttribute('type', 'image/svg+xml');
        await expect(favicon).toHaveAttribute('sizes', 'any');
        await expect(touch).toHaveAttribute('href', new RegExp(`${stem}app-icon\\.png\\?v=1\\.4\\.0$`));
        await expect(touch).toHaveAttribute('type', 'image/png');
        await expect(touch).toHaveAttribute('sizes', '512x512');
      }
    }
  }
  await page.evaluate(() => {
    const { app } = window.fixture;
    app.hass.selectedTheme.theme = app.hass.themes.theme = 'default';
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.locator('ha-sidebar .title')).toHaveText('Home Assistant');
  for (const [index, link] of [favicon, touch].entries()) {
    for (const [name, value] of Object.entries(originals[index])) await expect(link).toHaveAttribute(name, value);
  }
});

test('legacy alias uses Cobalt Vivid artwork and unknown civica names do not replace native identity', async ({ page }) => {
  await page.evaluate(() => {
    const { app } = window.fixture;
    app.hass.themes.themes.govuk = app.hass.themes.themes['civica Civic Cobalt Vivid'];
    app.hass.themes.theme = app.hass.selectedTheme.theme = 'govuk';
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', /themes\/civic-cobalt\/vivid\/app-icon\.svg\?v=1\.4\.0$/);
  await page.evaluate(() => {
    const { app } = window.fixture;
    app.hass.themes.themes['civica unrelated custom theme'] = {};
    app.hass.themes.theme = app.hass.selectedTheme.theme = 'civica unrelated custom theme';
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', '../../brand/civica/icons/favicon.ico');
});

test('civica default selects the supplied default artwork and can change tone without resetting display mode', async ({ page }) => {
  await page.evaluate(() => {
    window.fixture.app.hass.selectedTheme = { theme: 'civica', dark: true };
    window.fixture.paint();
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.getByLabel('Colour palette')).toHaveValue('civic-cobalt');
  await expect(page.getByRole('switch')).not.toBeChecked();
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', /themes\/civic-cobalt\/vivid\/app-icon\.svg\?v=1\.4\.0$/);
  await page.getByRole('switch').check();
  expect(await page.evaluate(() => window.fixture.app.hass.selectedTheme)).toEqual({ theme: 'civica Civic Cobalt Muted', dark: true });
});

test('production bundle waits for HA registry replacement before registering or starting its lifecycle', async ({ context }) => {
  const startup = await context.newPage();
  try {
    await startup.route('**/startup-registry-fixture', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Startup boundary fixture</title><body><home-assistant></home-assistant></body></html>',
    }));
    await startup.goto('/startup-registry-fixture');
    await startup.evaluate(() => {
      const native = window.customElements;
      let resolveReady;
      const readiness = new Promise(resolve => { resolveReady = resolve; });
      const state = window.bootstrap = { earlyDefinitions: [], finalDefinitions: [], waits: [], listeners: [], observers: 0, loaded: false };
      const addListener = window.addEventListener.bind(window);
      window.addEventListener = (type, ...args) => { state.listeners.push(type); return addListener(type, ...args); };
      const Observer = window.MutationObserver;
      window.MutationObserver = class extends Observer { constructor(callback) { super(callback); state.observers++; } };
      const early = {
        get: native.get.bind(native),
        define: (name, constructor) => { state.earlyDefinitions.push(name); native.define(name, constructor); },
        whenDefined: name => { state.waits.push(name); return name === 'home-assistant' ? readiness : native.whenDefined(name); },
      };
      Object.defineProperty(window, 'customElements', { configurable: true, value: early });
      state.start = import('/ui/dist/civica-ui.js?startup-registry-regression').then(() => { state.loaded = true; });
      state.finishStartup = async () => {
        const finalRegistry = {
          get: native.get.bind(native),
          define: (name, constructor) => { state.finalDefinitions.push(name); native.define(name, constructor); },
          whenDefined: native.whenDefined.bind(native),
        };
        Object.defineProperty(window, 'customElements', { configurable: true, value: finalRegistry });
        class HomeAssistant extends HTMLElement {}
        finalRegistry.define('home-assistant', HomeAssistant);
        // The scoped-registry polyfill defines a native stand-in, resolving
        // the readiness promise captured before the registry was replaced.
        resolveReady(HomeAssistant);
        await state.start;
      };
    });
    await expect.poll(() => startup.evaluate(() => window.bootstrap.waits)).toContain('home-assistant');
    expect(await startup.evaluate(() => ({
      definitions: window.bootstrap.earlyDefinitions,
      lifecycle: Boolean(window.__civicaUiInstalled),
      cards: window.customCards || [],
      observers: window.bootstrap.observers,
      loaded: window.bootstrap.loaded,
    }))).toEqual({ definitions: [], lifecycle: false, cards: [], observers: 0, loaded: false });
    await startup.evaluate(() => window.bootstrap.finishStartup());
    expect(await startup.evaluate(() => ({
      early: window.bootstrap.earlyDefinitions,
      registered: Boolean(customElements.get('civica-theme-settings')),
      definitions: window.bootstrap.finalDefinitions,
      lifecycle: window.__civicaUiInstalled,
      observers: window.bootstrap.observers,
    }))).toEqual({ early: [], registered: true, definitions: ['home-assistant', 'civica-theme-settings', 'civica-action-links'], lifecycle: true, observers: 1 });
    await startup.evaluate(async () => { await import('/ui/dist/civica-ui.js?startup-registry-second-instance'); });
    expect(await startup.evaluate(() => ({
      definitions: window.bootstrap.finalDefinitions,
      observers: window.bootstrap.observers,
      navigationListeners: window.bootstrap.listeners.filter(type => type === 'location-changed').length,
      cards: window.customCards.filter(card => card.type === 'civica-theme-settings').length,
    }))).toEqual({ definitions: ['home-assistant', 'civica-theme-settings', 'civica-action-links'], observers: 1, navigationListeners: 1, cards: 1 });
  } finally { await startup.close(); }
});

test('adopted HA styles keep nested masthead icons white without recolouring sidebar or body controls', async ({ page }) => {
  await page.evaluate(() => {
    const sheet = css => { const value = new CSSStyleSheet(); value.replaceSync(css); return value; };
    class NativeButton extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        root.adoptedStyleSheets = [sheet(':host([variant="neutral"]) { --wa-color-on-quiet: var(--wa-color-neutral-on-quiet); --wa-color-on-normal: var(--wa-color-neutral-on-normal); } button { font: inherit; } :host([appearance="plain"]) button { color:var(--wa-color-on-quiet); } :host([appearance="filled"]) button { color:var(--wa-color-on-normal); }')];
        const button = document.createElement('button'); button.textContent = 'Menu'; root.append(button);
      }
    }
    class NativeIcon extends HTMLElement {
      constructor() {
        super(); const root = this.attachShadow({ mode: 'open' });
        root.adoptedStyleSheets = [sheet('ha-button { --wa-color-on-normal: currentColor; }')];
        const button = document.createElement('ha-button'); button.setAttribute('appearance', 'plain'); button.setAttribute('variant', 'neutral'); root.append(button);
      }
    }
    class NativeMenu extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open' }).append(document.createElement('ha-icon-button')); }
    }
    customElements.define('ha-button', NativeButton);
    customElements.define('ha-icon-button', NativeIcon);
    customElements.define('ha-menu-button', NativeMenu);
    class Sidebar extends HTMLElement {
      constructor() {
        super(); const root = this.attachShadow({ mode: 'open' });
        // Adopted sheets win equal specificity over appended <style> tags,
        // exactly as in the live Core 2026.11 sidebar.
        root.adoptedStyleSheets = [sheet('.menu { background:var(--sidebar-menu-button-background-color); color:var(--sidebar-menu-button-text-color); } .menu ha-icon-button, .navigation ha-icon-button { color:var(--sidebar-icon-color); }')];
        const menu = document.createElement('div'); menu.className = 'menu';
        const title = document.createElement('div'); title.className = 'title'; title.textContent = 'Home Assistant';
        menu.append(document.createElement('ha-icon-button'), title);
        const navigation = document.createElement('div'); navigation.className = 'navigation'; navigation.append(document.createElement('ha-icon-button'));
        root.append(menu, navigation);
      }
    }
    const headerClass = selector => class extends HTMLElement {
      constructor() {
        super(); const root = this.attachShadow({ mode: 'open' });
        root.adoptedStyleSheets = [sheet(`.${selector} { color:var(--app-header-text-color); background:var(--app-header-background-color); } .toolbar ha-menu-button { color:var(--sidebar-icon-color); }`)];
        const toolbar = document.createElement('div'); toolbar.className = selector;
        const menu = document.createElement('ha-menu-button');
        const slot = document.createElement('slot'); slot.name = 'toolbar-icon';
        toolbar.append(menu, slot);
        const body = document.createElement('div'); body.className = 'body'; body.append(document.createElement('ha-icon-button'));
        root.append(toolbar, body);
      }
    };
    customElements.define('ha-sidebar', Sidebar);
    customElements.define('hass-subpage', headerClass('toolbar'));
    customElements.define('ha-top-app-bar-fixed', headerClass('top-app-bar'));
    const subpage = document.createElement('hass-subpage');
    const slottedIcon = document.createElement('ha-icon-button'); slottedIcon.slot = 'toolbar-icon'; subpage.append(slottedIcon);
    window.fixture.app.shadowRoot.append(document.createElement('ha-sidebar'), subpage, document.createElement('ha-top-app-bar-fixed'));
    window.dispatchEvent(new Event('location-changed'));
  });
  await expect(page.locator('ha-sidebar [data-civica-sidebar]')).toHaveCount(1);
  const masthead = page.locator('ha-sidebar .menu ha-icon-button');
  const headerButtons = [
    masthead.locator('button'),
    page.locator('hass-subpage .toolbar ha-menu-button button'),
    page.locator('hass-subpage > ha-icon-button[slot="toolbar-icon"] button'),
    page.locator('ha-top-app-bar-fixed .top-app-bar ha-menu-button button'),
  ];
  for (const name of ['civica Racing Moss Muted', 'civica Ink Charcoal Vivid', 'civica Civic Cobalt Vivid']) {
    await page.evaluate(theme => {
      window.fixture.app.hass.selectedTheme.theme = theme; window.fixture.paint();
      // Real HA resolves these neutral roles on the document, independently
      // from a coloured masthead. This reproduces the nested plain-button path.
      for (const name of ['--wa-color-neutral-on-quiet', '--wa-color-neutral-on-normal', '--wa-color-on-quiet', '--wa-color-on-normal']) document.documentElement.style.setProperty(name, '#0B0C0C');
    }, name);
    await expect(masthead).toHaveCSS('color', 'rgb(255, 255, 255)');
    for (const button of headerButtons) await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('ha-sidebar .navigation button')).toHaveCSS('color', 'rgb(11, 12, 12)');
    await expect(page.locator('hass-subpage .body button')).toHaveCSS('color', 'rgb(11, 12, 12)');
  }
  await page.evaluate(() => {
    window.fixture.app.hass.selectedTheme.theme = window.fixture.app.hass.themes.theme = 'default';
    window.dispatchEvent(new Event('settheme'));
  });
  await expect(page.locator('ha-sidebar [data-civica-sidebar]')).toHaveCount(0);
  await expect(page.locator('[data-civica-toolbar]')).toHaveCount(0);
  await expect(masthead).toHaveCSS('color', 'rgb(72, 73, 73)');
  for (const button of headerButtons) await expect(button).toHaveCSS('color', 'rgb(11, 12, 12)');
});
