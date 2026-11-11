import { test, expect } from '@playwright/test';
import { LEGACY_CARD_STYLES } from '../ui/src/legacy-card-styles.ts';

// Synthetic public contracts for the three existing cards. These fixtures have
// no device connections, personal records or service calls.
const fixtures = {
  'pa-appliance-card': `<ha-card><div class="wrap"><header class="header"><div><p class="brand">Example maker</p><h2>Washing machine</h2></div><p class="room">Kitchen</p></header><section class="hero"><svg class="portrait" viewBox="0 0 100 100" aria-hidden="true"><rect class="surface" x="20" y="10" width="60" height="80" stroke="currentColor"/></svg><div><p class="eyebrow">Reported status</p><p class="status">Off</p><dl class="metrics"><dt>Programme</dt><dd>Cotton</dd></dl></div></section><p class="warning" hidden>Example warning</p><div class="action-row"><button aria-disabled="true">Start unavailable</button><button>Details</button></div><div class="setting"><label for="setting">Suction</label><select id="setting"><option>Standard</option></select><button>Apply</button><small>Reported setting</small></div><details><summary>Readings</summary><div class="detail-row"><span>Power</span><strong>Off</strong></div></details></div></ha-card>`,
  'home-next-collection-card': `<ha-card><header><span class="calendar-icon" aria-hidden="true"></span><div><div class="kicker">Next collection</div><h2>Tomorrow</h2><p class="sub">Friday</p></div></header><ul class="bins"><li class="stream"><div class="picture"><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="50" height="80" x="25" y="10"/></svg></div><span class="label">Food waste</span></li><li class="stream"><div class="picture"></div><span class="label">Garden waste</span></li></ul><p class="caption">Everything listed for this collection day.</p><footer><span class="hint">Your collection calendar</span><a href="#calendar">Open calendar <span aria-hidden="true">↗</span></a></footer><details><summary>How this is shown</summary>Calendar information.</details></ha-card>`,
  'pa-gas-safety-card': `<ha-card class="gs-card" data-state="passed"><section class="gs-face" aria-label="Gas safety record"><div class="gs-header"><h2 class="gs-heading">Gas safety</h2><span class="gs-tag">Home record</span></div><div class="gs-date-area"><div><div class="gs-kicker">Recorded date passed</div><p class="gs-date">10 Nov 2026</p><div class="gs-weekday">Tuesday</div></div><svg class="gs-art" viewBox="0 0 112 136" aria-hidden="true"><path fill="url(#test)" d="M0 0H112V136H0Z"/></svg></div><div class="gs-countdown"><span class="gs-count-number">1</span><span class="gs-count-label">day past the date</span><span class="gs-recorded">Date recorded</span></div></section><div class="gs-foot"><details class="gs-details"><summary>Record details</summary><p>This record is not a certificate validity assessment.</p></details><nav class="gs-actions" aria-label="Gas safety record actions"><a class="gs-button gs-button-primary" href="#record">Manage record</a><a class="gs-button" href="#register">Official register</a></nav></div></ha-card>`,
};

const originalStyles = `:host{display:block;container-type:inline-size}ha-card{display:block;border:1px solid var(--divider-color);border-radius:18px}h2{font-size:20px;font-weight:600}.wrap{padding:16px}.hero{display:grid;grid-template-columns:34% 1fr;padding:10px;border:1px solid var(--divider-color);border-radius:12px}.portrait{width:100%;max-height:135px}.brand,.room,.eyebrow,.metrics dt,.caption,.kicker,.label,.hint,.gs-kicker,.gs-tag{font-size:11px;letter-spacing:.08em;text-transform:uppercase}.warning{display:flex}.action-row{display:flex;flex-wrap:wrap}.setting{display:grid;grid-template-columns:minmax(0,1fr) auto}.setting label,.setting small{grid-column:1/-1}button,select{border:1px solid var(--divider-color);border-radius:10px;font-size:13px}header,.gs-header,.gs-countdown,footer{display:flex}.bins{display:grid;grid-template-columns:1fr 1fr;list-style:none;padding:0}.picture{border:1px solid var(--divider-color);border-radius:12px;height:82px}.picture svg{height:68px;width:68px}.gs-face{background:#171812;color:#fff1a3;border-top:5px solid #ffdc3c}.gs-date-area{display:grid;grid-template-columns:1fr 92px}.gs-actions{display:grid;grid-template-columns:1fr 1fr}.gs-button{border:1px solid var(--divider-color);border-radius:10px}.gs-button-primary{background:#ffdf47;color:#171812}.gs-card[data-state=passed] .gs-kicker{color:#ffcf8a}summary{min-height:44px}summary::before{content:'ⓘ'}`;

for (const mode of ['light', 'dark']) test(`legacy cards retain content and controls with readable ${mode} styling at 320px`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/card/dev/');
  await expect(page.getByRole('heading', { name: 'House lighting', exact: true })).toBeVisible();
  await page.locator('#preview-mode').selectOption(mode);
  await page.evaluate(({ styles, fixtures, originalStyles }) => {
    const mount = document.querySelector('#mount'); mount.replaceChildren();
    for (const [tag, markup] of Object.entries(fixtures)) {
      const card = document.createElement(tag); const shadow = card.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${originalStyles}</style>${markup}`;
      const sheet = new CSSStyleSheet(); sheet.replaceSync(styles[tag]); shadow.adoptedStyleSheets = [sheet];
      mount.append(card);
    }
  }, { styles: LEGACY_CARD_STYLES, fixtures, originalStyles });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const tag of Object.keys(fixtures)) {
    const card = page.locator(tag);
    expect(await card.locator('ha-card').evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
    expect(await card.locator('h2').evaluate(el => getComputedStyle(el).fontSize)).toBe('24px');
  }
  const appliance = page.locator('pa-appliance-card');
  await expect(appliance.locator('.warning')).toBeHidden();
  await expect(appliance.locator('.portrait')).toBeVisible();
  await expect(appliance.getByRole('button', { name: 'Start unavailable' })).toHaveAttribute('aria-disabled', 'true');
  expect(await appliance.locator('.hero').evaluate(el => getComputedStyle(el).borderWidth)).toBe('0px');
  expect(await appliance.locator('.eyebrow').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  const select = appliance.getByLabel('Suction');
  expect(await select.evaluate(el => getComputedStyle(el).borderWidth)).toBe('2px');
  await select.focus(); await page.keyboard.press('ArrowDown');
  const details = appliance.getByRole('button', { name: 'Details', exact: true });
  await details.focus(); await details.hover();
  expect(await details.evaluate(el => getComputedStyle(el).color)).toBe('rgb(11, 12, 12)');
  const gas = page.locator('pa-gas-safety-card');
  await expect(gas.getByText('Recorded date passed', { exact: true })).toBeVisible();
  expect(await gas.locator('.gs-face').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await gas.locator('ha-card').evaluate(el => getComputedStyle(el).backgroundColor));
  await gas.getByText('Record details', { exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(gas.getByText('This record is not a certificate validity assessment.')).toBeVisible();
  await expect(page.locator('home-next-collection-card .picture svg')).toBeVisible();
});
