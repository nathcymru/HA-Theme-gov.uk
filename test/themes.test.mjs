import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { palettes, allThemes, generatedFiles, contrast, rgb } from '../scripts/generate-themes.mjs';

const themes = allThemes();
test('default civica theme and legacy alias resolve to the same complete palette without changing saved selections', () => {
  const files = generatedFiles();
  const installed = parse(files['themes/civica.yaml']);
  const legacy = parse(files['themes/govuk.yaml']).govuk;
  assert.equal(Object.keys(installed).length, 21);
  const { 'card-mod-theme': defaultName, ...defaultTokens } = installed.civica;
  const { 'card-mod-theme': legacyName, ...legacyTokens } = legacy;
  const { 'card-mod-theme': variantName, ...variantTokens } = installed['civica Civic Cobalt Vivid'];
  assert.equal(defaultName, 'civica');
  assert.equal(legacyName, 'govuk');
  assert.equal(variantName, 'civica Civic Cobalt Vivid');
  assert.deepEqual(defaultTokens, variantTokens);
  assert.deepEqual(legacyTokens, variantTokens);
  for (const [name, theme] of Object.entries(themes)) assert.deepEqual(installed[name], theme);
});
function minimum(foreground, background, ratio, description) {
  const actual = contrast(foreground, background);
  assert.ok(actual >= ratio, `${description}: ${foreground} on ${background} is ${actual.toFixed(2)}:1, needs ${ratio}:1`);
}

test('all supplied palettes preserve the exact screen colours and complete print metadata', () => {
  const expected = [
    ['Civic Cobalt', '#1D70B8', '#103E65', '#F3F6F9'],
    ['Racing Moss', '#006853', '#00392E', '#F2F6F4'],
    ['Imperial Damson', '#732282', '#3F1348', '#F6F3F7'],
    ['Sovereign Crimson', '#B2292E', '#621719', '#F9F4F4'],
    ['Regimental Plum', '#532A45', '#2E1726', '#F7F3F5'],
    ['Oxford Midnight', '#003764', '#001E37', '#F2F4F8'],
    ['Ink Charcoal', '#0B0C0C', '#2B2E30', '#F3F2F1'],
    ['Heritage Ochre', '#8A6100', '#4D3600', '#F9F7F1'],
    ['Kiln Terracotta', '#9E3B0E', '#572008', '#F9F5F2'],
    ['Umber Bronze', '#5C3D28', '#332216', '#F6F4F1'],
  ];
  assert.deepEqual(palettes.palettes.map((p) => [p.name, p.vivid.primary.hex, p.muted.primary.hex, p.muted.canvas.hex]), expected);
  for (const palette of palettes.palettes) {
    assert.equal(palette.vivid.canvas.hex, '#FFFFFF');
    for (const tone of ['vivid', 'muted']) for (const colour of Object.values(palette[tone])) {
      assert.deepEqual(colour.rgb, rgb(colour.hex));
      assert.deepEqual(colour.rgba, [...colour.rgb, 1]);
      assert.equal(colour.cmyk.length, 4);
      assert.ok(colour.cmyk.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 100));
      assert.ok(colour.reference);
    }
  }
});

test('20 native themes each offer separate light and dark modes without restricted branding fonts', () => {
  assert.equal(Object.keys(themes).length, 20);
  for (const [name, theme] of Object.entries(themes)) {
    assert.match(name, /^civica /);
    assert.deepEqual(Object.keys(theme.modes), ['light', 'dark']);
    assert.ok(!JSON.stringify(theme).includes('GDS Transport'));
    assert.equal(theme['ha-border-radius-circle'], undefined, 'preserve native radio/avatar circle');
    assert.equal(theme['ha-border-radius-pill'], undefined, 'preserve native switch affordance');
    for (const size of ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']) {
      assert.equal(theme[`ha-border-radius-${size}`], undefined, `preserve native ${size} radius, including sidebar notification badges`);
    }
    assert.equal(theme['ha-button-border-radius'], '0px');
    assert.equal(theme['ha-dialog-width-lg'], undefined, 'do not constrain every native dialog to a narrow fixed width');
  }
});

test('structural borders stay quiet while control, input and focus boundaries remain distinct', () => {
  for (const [name, theme] of Object.entries(themes)) for (const [mode, values] of Object.entries(theme.modes)) {
    const v = { ...theme, ...values };
    const quiet = mode === 'light' ? '#CECECE' : '#50565A';
    for (const key of ['civica-border-quiet', 'ha-card-border-color', 'divider-color', 'mdc-dialog-scroll-divider-color', 'ha-color-border-neutral-quiet', 'wa-color-surface-border', 'wa-color-neutral-border-quiet']) {
      assert.equal(v[key], quiet, `${name} ${mode}: ${key} must use the structural border`);
    }
    const control = v['civica-border-interactive'];
    minimum(control, v['card-background-color'], 3, `${name} ${mode} control boundary`);
    assert.ok(contrast(quiet, v['card-background-color']) < contrast(control, v['card-background-color']), `${name} ${mode} divisions must be quieter than controls`);
    for (const key of ['outline-color', 'slider-track-color', 'ha-color-border-neutral-normal', 'wa-color-neutral-border-normal']) assert.equal(v[key], control);
    for (const key of ['input-idle-line-color', 'input-outlined-idle-border-color', 'wa-form-control-border-color', 'ha-color-border-neutral-loud']) assert.equal(v[key], v['primary-text-color']);
    assert.equal(v['civica-input-border'], mode === 'light' ? '#0B0C0C' : '#FFFFFF');
    assert.equal(v['ha-color-focus'], '#FFDD00');
    assert.equal(v['civica-focus-text'], '#0B0C0C');
  }
});

test('native dashboard section titles share the scaled bold card heading hierarchy', () => {
  for (const [name, theme] of Object.entries(themes)) for (const [mode, values] of Object.entries(theme.modes)) {
    const v = { ...theme, ...values };
    const label = `${name} ${mode}`;
    assert.equal(v['ha-heading-card-title-font-size'], v['ha-card-header-font-size'], `${label} section headings must not fall below card titles`);
    assert.equal(v['ha-heading-card-title-font-size'], 'var(--civica-font-size-heading)');
    assert.equal(v['civica-font-size-heading'], 'calc(24px * var(--ha-font-size-scale, 1))', `${label} native user text scaling must remain effective`);
    assert.equal(v['ha-heading-card-title-font-weight'], '700', `${label} H2 must not inherit the normal-weight fallback`);
    assert.equal(v['ha-heading-card-title-line-height'], '1.25');
    for (const suffix of ['font-size', 'font-weight', 'line-height']) {
      assert.equal(v[`ha-heading-card-subtitle-${suffix}`], undefined, `${label} captions retain their native supporting hierarchy`);
    }
  }
});

test('notification badges retain MOJ red, white text and rounded geometry across every palette and mode', () => {
  const expected = {
    'background': '#CA3535', 'color': '#FFFFFF', 'border-radius': '10em',
    'font-size': 'calc(16px * var(--ha-font-size-scale, 1))', 'font-weight': '700', 'line-height': '1.25',
    'min-width': '.75em', 'min-height': '1.25em', 'padding': '1px .25em 0', 'margin-left': '.5em',
    'outline': '4px solid var(--civica-notification-badge-background)', 'outline-offset': '-.1em',
  };
  for (const [name, theme] of Object.entries(themes)) for (const values of Object.values(theme.modes)) {
    const v = { ...theme, ...values };
    for (const [suffix, value] of Object.entries(expected)) assert.equal(v[`civica-notification-badge-${suffix}`], value, `${name} ${suffix}`);
    minimum(v['civica-notification-badge-color'], v['civica-notification-badge-background'], 4.5, `${name} notification numeral`);
    // The dark sidebar uses the canvas rather than the raised card surface so
    // the unchanged MOJ red circle retains a visible boundary in both modes.
    minimum(v['civica-notification-badge-background'], v['sidebar-background-color'], 3, `${name} notification badge boundary`);
    assert.notEqual(v['civica-notification-badge-border-radius'], v['ha-button-border-radius']);
  }
});

test('navigation icons use separate neutral, active and masthead roles', () => {
  for (const [name, theme] of Object.entries(themes)) for (const [mode, values] of Object.entries(theme.modes)) {
    const v = { ...theme, ...values };
    assert.equal(v['sidebar-icon-color'], v['civica-navigation-icon-color']);
    assert.equal(v['sidebar-selected-icon-color'], v['civica-navigation-icon-active-color']);
    assert.equal(v['sidebar-menu-button-text-color'], v['civica-navigation-icon-masthead-color']);
    minimum(v['sidebar-icon-color'], v['sidebar-background-color'], 3, `${name} ${mode} navigation icon`);
    minimum(v['sidebar-selected-icon-color'], v['sidebar-selected-background-color'], 3, `${name} ${mode} selected navigation icon`);
    minimum(v['civica-navigation-icon-masthead-color'], v['sidebar-menu-button-background-color'], 3, `${name} ${mode} masthead icon`);
  }
});

test('text, native inputs, header, selected navigation and all action states pass AA for every variant/mode', () => {
  for (const [name, theme] of Object.entries(themes)) for (const [mode, values] of Object.entries(theme.modes)) {
    const v = { ...theme, ...values };
    const label = `${name} ${mode}`;
    for (const surface of ['primary-background-color', 'card-background-color', 'secondary-background-color']) {
      for (const text of ['primary-text-color', 'secondary-text-color', 'link-color', 'error-color', 'warning-color', 'success-color', 'info-color']) minimum(v[text], v[surface], 4.5, `${label} ${text}/${surface}`);
    }
    for (const [fg, bg] of [
      ['text-primary-color', 'primary-color'], ['text-primary-color', 'dark-primary-color'],
      ['input-ink-color', 'input-fill-color'], ['app-header-text-color', 'app-header-background-color'],
      ['sidebar-menu-button-text-color', 'sidebar-menu-button-background-color'],
      ['sidebar-text-color', 'sidebar-background-color'], ['sidebar-selected-text-color', 'sidebar-selected-background-color'],
      ['civica-on-danger', 'civica-danger-fill'], ['civica-on-success', 'civica-success-fill'],
      ['civica-on-warning', 'civica-warning-fill'], ['civica-on-notice', 'civica-notice-fill'],
    ]) minimum(v[fg], v[bg], 4.5, `${label} ${fg}/${bg}`);
    for (const role of ['primary', 'neutral', 'danger', 'warning', 'success']) {
      for (const volume of ['quiet', 'normal', 'loud']) {
        const fg = v[`ha-color-on-${role}-${volume}`];
        for (const state of ['resting', 'hover', 'active']) minimum(fg, v[`ha-color-fill-${role}-${volume}-${state}`], 4.5, `${label} ${role} ${volume} ${state}`);
      }
    }
    for (const background of ['input-fill-color', 'card-background-color', 'primary-background-color']) {
      minimum(v['input-idle-line-color'], v[background], 3, `${label} input border`);
      minimum(v['wa-focus-ring-color'], v[background], 3, `${label} native focus`);
    }
    minimum(v['ha-switch-checked-thumb-background-color'], v['ha-switch-checked-background-color'], 3, `${label} switch thumb`);
    minimum(v['wa-color-brand-border-normal'], v['card-background-color'], 3, `${label} native button outline`);
    minimum(v['ha-color-focus'], v['app-header-background-color'], 3, `${label} scoped header focus`);
    minimum(v['civica-focus-text'], v['ha-color-focus'], 3, `${label} custom two-colour focus`);
    for (let i = 1; i <= 24; i++) minimum(v[`civica-chart-${i}`], v['card-background-color'], 3, `${label} chart series ${i}`);
  }
});

test('semantic meanings and chart series remain stable across palette choices', () => {
  const entries = Object.values(themes);
  for (const mode of ['light', 'dark']) for (const other of entries.slice(1)) {
    for (const key of ['error-color', 'warning-color', 'success-color', 'info-color']) {
      assert.equal(other.modes[mode][key], entries[0].modes[mode][key], `${mode} ${key}`);
    }
  }
  for (const tone of ['Vivid', 'Muted']) for (const mode of ['light', 'dark']) {
    const sameTone = Object.entries(themes).filter(([name]) => name.endsWith(tone)).map(([, theme]) => theme);
    for (const theme of sameTone) {
      assert.equal(theme.modes[mode]['civica-chart-tone'], tone.toLowerCase());
      assert.equal(theme.modes[mode]['civica-chart-mode'], mode);
      for (let i = 1; i <= 24; i++) assert.equal(theme.modes[mode][`civica-chart-${i}`], sameTone[0].modes[mode][`civica-chart-${i}`]);
    }
  }
  for (const palette of palettes.palettes) for (const mode of ['light', 'dark']) {
    const vivid = themes[`civica ${palette.name} Vivid`].modes[mode];
    const muted = themes[`civica ${palette.name} Muted`].modes[mode];
    for (let i = 1; i <= 24; i++) assert.notEqual(vivid[`civica-chart-${i}`], muted[`civica-chart-${i}`]);
  }
});

test('native modern, legacy and panel surfaces resolve to the same theme', () => {
  for (const theme of Object.values(themes)) for (const v of Object.values(theme.modes)) {
    assert.equal(v['primary-color'], v['ha-color-fill-primary-loud-resting']);
    assert.equal(v['primary-color'], v['mdc-theme-primary']);
    assert.equal(v['text-primary-color'], v['ha-color-on-primary-loud']);
    assert.equal(v['card-background-color'], v['ha-color-surface-default']);
    assert.equal(v['ha-panel-background'], v['primary-background-color']);
    assert.equal(v['lovelace-background'], v['primary-background-color']);
    assert.equal(v['rgb-primary-color'], rgb(v['primary-color']).join(', '));
  }
});

test('committed generated outputs exactly match their canonical sources', () => {
  for (const [path, expected] of Object.entries(generatedFiles())) assert.equal(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), expected, path);
});
