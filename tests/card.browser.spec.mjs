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
  await expect(page.getByText('1 light unavailable', { exact: true })).toBeVisible();
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

test('room counts retain unavailable and unknown members while excluding reserved lights', async ({ page }) => {
  await openCard(page);
  const hall = page.locator('[data-room="hall"].row');
  await expect(hall.locator('[data-role=sub]')).toHaveText('1 of 2 available lights on; 1 light unavailable');
  await page.evaluate(() => { window.fixtureHass.states['light.h2'].state = 'unknown'; window.card.hass = window.fixtureHass; });
  await expect(hall.locator('[data-role=sub]')).toHaveText('1 of 1 available light on; 1 light unavailable; 1 light unknown');
  await page.evaluate(() => { delete window.fixtureHass.states['light.h3']; window.card.hass = window.fixtureHass; });
  await expect(hall.locator('[data-role=sub]')).toHaveText('1 light unavailable; 2 lights unknown');
  await expect(hall.locator('[data-role=toggle]')).toBeDisabled();
});

test('off summaries retain unknown and unavailable members and never count a reserved light as managed', async ({ page }) => {
  await openCard(page);
  const hall = page.locator('[data-room="hall"].row');
  const cases = [
    { states: ['off', 'off', 'unavailable'], text: '2 of 2 available lights off; 1 light unavailable', enabled: true },
    { states: ['unknown', 'off', 'unavailable'], text: '1 of 1 available light off; 1 light unavailable; 1 light unknown', enabled: true },
    { states: ['unknown', 'unknown', 'unknown'], text: '3 lights unknown', enabled: false },
    { states: ['off', 'off', 'off'], text: '3 of 3 lights off', enabled: true },
  ];
  for (const { states, text, enabled } of cases) {
    await page.evaluate(states => {
      // A reserved, physically on light must not change the managed denominator.
      window.fixtureHass.states['light.h1'].state = 'on';
      ['light.h2', 'light.h3', 'light.hue'].forEach((id, i) => { window.fixtureHass.states[id].state = states[i]; });
      window.card.hass = window.fixtureHass;
    }, states);
    await expect(hall.locator('[data-role=sub]')).toHaveText(text);
    await expect(page.locator('.hit[data-room="hall"]')).toHaveAccessibleName(`Hallway, ${text}.${enabled ? ' Open lighting settings.' : ''}`);
    if (enabled) await expect(hall.locator('[data-role=toggle]')).toHaveText('Turn on');
    await expect(hall.locator('[data-role=toggle]')).toBeEnabled({ enabled });
  }
  await page.evaluate(() => {
    for (const id of ['light.h2', 'light.h3', 'light.hue']) window.fixtureHass.entities[id].labels = ['govuk_lighting_reserved'];
    window.card.hass = window.fixtureHass;
  });
  await expect(hall.locator('[data-role=sub]')).toHaveText('Lights controlled elsewhere');
  await expect(hall.locator('[data-role=toggle]')).toBeDisabled();
  expect(await page.evaluate(() => window.calls)).toEqual([]);
});

test('all off does not operate unknown members or mistake a reserved on light for a managed room state', async ({ page }) => {
  await openCard(page);
  await page.evaluate(() => {
    for (const id of ['light.l1', 'light.l2', 'light.b1', 'light.h3']) window.fixtureHass.states[id].state = 'off';
    window.fixtureHass.states['light.h2'].state = 'unknown';
    window.fixtureHass.states['light.h1'].state = 'on'; // reserved for the door automation
    window.card.hass = window.fixtureHass;
  });
  await page.getByRole('button', { name: 'Turn all off', exact: true }).click();
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await expect(page.locator('[data-room="hall"].row [data-role=sub]')).toHaveText('1 of 1 available light off; 1 light unavailable; 1 light unknown');
  await expect(page.locator('civica-house-lighting-card .status')).toHaveText('0 of 3 available rooms on');
});

for (const retirement of ['disconnect', 'reconfigure']) {
  test(`a ${retirement} retires a pending batch without sending later rooms or unlocking its replacement`, async ({ page }) => {
    await openCard(page);
    await page.evaluate(() => {
      window.batchResolvers = [];
      window.fixtureHass.callService = (domain, service, data, target) => {
        window.calls.push({ domain, service, data, target });
        return new Promise(resolve => window.batchResolvers.push(resolve));
      };
    });
    const allOn = page.getByRole('button', { name: 'Turn all on', exact: true });
    await allOn.click();
    expect(await page.evaluate(() => window.calls.length)).toBe(1);
    await page.evaluate(retirement => {
      if (retirement === 'disconnect') {
        const parent = window.card.parentElement;
        window.card.remove(); parent.append(window.card);
      } else window.card.setConfig({ type: 'custom:civica-house-lighting-card' });
    }, retirement);
    await expect(allOn).toBeEnabled();
    await expect(page.locator('[data-room="lounge"].row [data-role=request-status]')).toBeEmpty();
    await allOn.click();
    expect(await page.evaluate(() => window.calls.length)).toBe(2);
    await page.evaluate(async () => {
      // Completing a retired service call cannot cancel its physical operation;
      // it must only stop that old UI batch from dispatching further rooms.
      window.batchResolvers[0]();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await page.evaluate(() => window.calls.length)).toBe(2);
    await expect(page.locator('[data-room="lounge"].row [data-role=request-status]')).toContainText('Sending the request');
    // Hall has no request of its own yet: this specifically checks that the
    // old finally block cannot clear the newer batch's global pending state.
    await expect(page.locator('[data-room="hall"].row [data-role=toggle]')).toBeDisabled();
    await expect(allOn).toBeDisabled();
    await page.evaluate(() => window.card.remove());
  });
}

test('room request suppresses duplicates and distinguishes acceptance from reported state', async ({ page }) => {
  await openCard(page);
  await page.evaluate(() => { window.fixtureHass.callService = (...args) => { window.calls.push(args); return new Promise(resolve => { window.finishRequest = resolve; }); }; });
  const room = page.locator('[data-room="lounge"].row'), toggle = room.locator('[data-role=toggle]'), status = room.locator('[role=status]');
  await toggle.click();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAccessibleName('Request pending for Lounge');
  await expect(status).toContainText('Sending the request');
  await expect(page.getByRole('button', { name: 'Turn all on', exact: true })).toBeDisabled();
  await toggle.evaluate(button => { button.click(); button.click(); });
  expect(await page.evaluate(() => window.calls.length)).toBe(1);
  await page.evaluate(() => window.finishRequest());
  await expect(status).toHaveText('Request accepted. Waiting for the requested lights to report off.');
  await expect(toggle).toBeDisabled();
  await page.evaluate(() => {
    for (const id of ['light.l1', 'light.l2']) { window.fixtureHass.states[id].state = 'off'; window.fixtureHass.states[id].attributes.assumed_state = true; }
    window.card.hass = window.fixtureHass;
  });
  await expect(toggle).toBeDisabled();
  await page.evaluate(() => { for (const id of ['light.l1', 'light.l2']) delete window.fixtureHass.states[id].attributes.assumed_state; window.card.hass = window.fixtureHass; });
  await expect(status).toContainText('The requested lights reported off');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveText('Turn on');
  await expect(page.getByRole('button', { name: 'Turn all on', exact: true })).toBeEnabled();
});

test('unconfirmed timeout offers recovery without inventing failure or cancelling an in-flight request', async ({ page }) => {
  await page.clock.install(); await openCard(page);
  await page.evaluate(() => { window.fixtureHass.callService = () => new Promise(resolve => { window.finishRequest = resolve; }); });
  const room = page.locator('[data-room="lounge"].row'), toggle = room.locator('[data-role=toggle]'), status = room.locator('[role=status]');
  await toggle.click(); await page.clock.fastForward(20001);
  await expect(status).toContainText('The requested change is not confirmed');
  await expect(status).toContainText('The original request is still pending');
  await expect(toggle).toBeDisabled();
  await expect(room.getByRole('button', { name: 'Settings for Lounge' })).toBeEnabled();
  await page.evaluate(() => window.finishRequest());
  await expect(toggle).toBeEnabled();
  await expect(status).not.toContainText('original request is still pending');
  await expect(status).not.toContainText('reported off');
});

test('rejected and disconnected room requests do not leave stale pending controls', async ({ page }) => {
  await openCard(page); await page.evaluate(() => { window.failNext = true; });
  const room = page.locator('[data-room="lounge"].row');
  await room.locator('[data-role=toggle]').click();
  await expect(room.locator('[role=status]')).toContainText('The request was not confirmed');
  await expect(room.locator('[data-role=toggle]')).toBeEnabled();
  await page.evaluate(() => { window.fixtureHass.callService = () => new Promise(resolve => { window.finishRequest = resolve; }); });
  await room.locator('[data-role=toggle]').click();
  await page.evaluate(() => { const parent = window.card.parentElement; window.card.remove(); parent.append(window.card); window.finishRequest(); });
  await expect(room.locator('[role=status]')).toBeEmpty();
  await expect(room.locator('[data-role=toggle]')).toBeEnabled();
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
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCard(page); await mountDialogFixture(page);
  await page.locator('#preview-mode').selectOption('dark');
  await page.getByRole('button', { name: 'Settings for Lounge', exact: true }).click();
  const scenes = page.getByRole('region', { name: 'Scenes for Lounge' });
  await expect(scenes).toBeVisible();
  const christmas = scenes.getByRole('button', { name: 'Christmas', exact: true });
  await expect(christmas).toBeVisible();
  await expect(christmas.locator('ha-icon')).toHaveAttribute('icon', 'mdi:string-lights');
  await expect(christmas.locator('ha-icon')).toHaveAttribute('aria-hidden', 'true');
  expect(await scenes.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab'); await christmas.focus(); await christmas.hover();
  expect(await christmas.evaluate(element => getComputedStyle(element).color)).toBe('rgb(11, 12, 12)');
  expect(await christmas.locator('ha-icon').evaluate(element => getComputedStyle(element).color)).toBe('rgb(11, 12, 12)');
  await page.keyboard.press('Enter');
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
