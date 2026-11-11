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
  await expect(page.locator('ha-sidebar img')).toHaveAttribute('alt', 'civica.uk');
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
