import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openCard(page) {
  await page.goto('/card/dev/');
  await expect(page.getByRole('heading', { name: 'House lighting', exact: true })).toBeVisible();
}
async function mountDialogFixture(page, entityId = 'light.govuk_lights_lounge') {
  // Minimal native light host contract. This does not claim to test actual HA controls.
  await page.evaluate((entityId) => {
    const ha = document.createElement('home-assistant'); ha.attachShadow({ mode: 'open' });
    const dlg = document.createElement('ha-more-info-dialog'); dlg.attachShadow({ mode: 'open' });
    const light = document.createElement('more-info-light'); light.stateObj = { entity_id: entityId }; light.attachShadow({ mode: 'open' });
    const controls = document.createElement('div'); controls.className = 'controls';
    const native = document.createElement('input'); native.type = 'range'; native.setAttribute('aria-label', 'Brightness'); controls.append(native);
    light.shadowRoot.append(controls); dlg.shadowRoot.append(light); ha.shadowRoot.append(dlg); document.body.append(ha);
    window.fixtureLight = light; window.fixtureDialog = dlg;
  }, entityId);
}

test('mobile reflow, named controls, unavailable explanation and accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await openCard(page);
  await expect(page.getByText('Lights unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('No lights assigned', { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const controls = page.locator('civica-house-lighting-card button');
  for (const button of await controls.all()) {
    const box = await button.boundingBox(); if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('14px');
  expect(await page.getByRole('button', { name: 'Turn off Lounge', exact: true }).evaluate(el => getComputedStyle(el).fontSize)).toBe('19px');
  expect(await page.locator('civica-house-lighting-card .status').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('all on includes partially lit rooms and excludes reserved or unavailable lights', async ({ page }) => {
  await openCard(page); await page.getByRole('button', { name: 'Turn all on', exact: true }).click();
  const calls = await page.evaluate(() => window.calls);
  const ids = calls.flatMap((call) => call.target?.entity_id ?? []);
  expect(ids).toContain('light.l2'); expect(ids).toContain('light.l1');
  expect(ids).not.toContain('light.h1'); expect(ids).not.toContain('light.hue'); expect(ids).not.toContain('light.o1');
});

test('batch failures stay visible and summary link focuses the matching room error', async ({ page }) => {
  await openCard(page); await page.evaluate(() => { window.failNext = true; });
  await page.getByRole('button', { name: 'Turn all on', exact: true }).click();
  const summary = page.locator('.error-summary');
  await expect(summary.getByRole('link')).toHaveCount(3);
  await summary.getByRole('link', { name: /Lounge could not/ }).click();
  await expect(page.locator('#error-lounge')).toBeFocused();
});

test('keyboard focus survives hover in dark mode', async ({ page }) => {
  await openCard(page); await page.locator('#preview-mode').selectOption('dark');
  const button = page.getByRole('button', { name: 'Turn all on', exact: true });
  await page.keyboard.press('Tab'); await button.focus(); await button.hover();
  expect(await button.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  expect(await button.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(11, 12, 12)');
});

test('native dialog adapter scopes scene actions and cleans up after entity navigation', async ({ page }) => {
  await openCard(page); await mountDialogFixture(page);
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  const scenes = page.getByRole('region', { name: 'Scenes for Lounge' });
  await expect(scenes).toBeVisible();
  await expect(scenes.getByRole('button', { name: 'Christmas', exact: true })).toBeVisible();
  await scenes.getByRole('button', { name: 'Christmas', exact: true }).click();
  await expect(scenes.getByRole('status')).toContainText('Christmas requested');
  await expect(page.getByRole('slider', { name: 'Brightness' })).toBeVisible();
  await page.evaluate(() => { window.fixtureLight.stateObj = { entity_id: 'light.other' }; window.fixtureLight.shadowRoot.append(document.createElement('span')); });
  await expect(scenes).toHaveCount(0);
});

test('wrong native entity never receives a previous room scene control', async ({ page }) => {
  await openCard(page); await mountDialogFixture(page, 'light.other');
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  await page.waitForTimeout(150);
  await expect(page.locator('.civica-scenes')).toHaveCount(0);
});

test('flashing scene requires confirmation and reports permission failures inside the open dialog', async ({ page }) => {
  await openCard(page); await mountDialogFixture(page);
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  const scenes = page.getByRole('region', { name: 'Scenes for Lounge' });
  await scenes.getByRole('button', { name: 'Emergency (police pulse)', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Warning: flashing lights' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await scenes.getByRole('button', { name: 'Emergency (police pulse)', exact: true }).click();
  await page.evaluate(() => { window.failNext = true; });
  await page.getByRole('button', { name: 'Start flashing', exact: true }).click();
  await expect(scenes.getByRole('status')).toContainText('could not be applied');
  const calls = await page.evaluate(() => window.calls);
  expect(calls).toHaveLength(1); expect(calls[0].domain).toBe('input_boolean');
});


test('native group controls recognise fresh generated IDs and cannot bypass reserved ownership', async ({ page }) => {
  await openCard(page);
  await page.evaluate(() => {
    const states = window.fixtureHass.states;
    states['light.lights_lounge'] = { ...states['light.govuk_lights_lounge'], entity_id: 'light.lights_lounge' };
    delete states['light.govuk_lights_lounge'];
    window.card.addEventListener('hass-more-info', (event) => { window.lastMoreInfo = event.detail.entityId; });
    window.card.hass = window.fixtureHass;
  });
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  expect(await page.evaluate(() => window.lastMoreInfo)).toBe('light.lights_lounge');
  await page.evaluate(() => {
    window.fixtureHass.states['light.lounge_nested'] = { entity_id: 'light.lounge_nested', state: 'on', attributes: { entity_id: ['light.l1', 'light.l2'] } };
    window.fixtureHass.states['light.lights_lounge'].attributes.entity_id = ['light.lounge_nested'];
    window.card.hass = window.fixtureHass;
  });
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  expect(await page.evaluate(() => window.lastMoreInfo)).toBe('light.lights_lounge');
  await page.evaluate(() => {
    window.fixtureHass.entities['light.l2'].labels = ['govuk_lighting_reserved'];
    window.card.hass = window.fixtureHass;
  });
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  expect(await page.evaluate(() => window.lastMoreInfo)).toBe('light.l1');
  for (const members of [['light.lounge_nested'], ['light.unverified']]) {
    await page.evaluate((members) => {
      window.fixtureHass.entities['light.l2'].labels = [];
      window.fixtureHass.states['light.lounge_nested'].attributes.entity_id = members;
      window.card.hass = window.fixtureHass;
    }, members);
    await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
    expect(await page.evaluate(() => window.lastMoreInfo)).toBe('light.l1');
  }
});
