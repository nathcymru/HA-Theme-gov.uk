import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chartColour } from '../design-system/chart-colours.mjs';

const root = new URL('../', import.meta.url);
export const palettes = JSON.parse(readFileSync(new URL('design-system/palettes.json', root), 'utf8'));
export const rgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16));
const hex = (channels) => '#' + channels.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
export const mix = (a, b, fraction) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * fraction));
const luminance = (value) => rgb(value).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
export const themeName = (palette, tone) => `civica ${palette.name} ${tone[0].toUpperCase()}${tone.slice(1)}`;
const INK = '#0B0C0C';
const WHITE = '#FFFFFF';
const FOCUS = '#FFDD00';
const SEMANTIC = { danger: '#CA3535', warning: '#8A6100', success: '#0F7A52', info: '#1D70B8' };

// Primary source reviewed 11 November 2026: home-assistant/frontend
// e32bc0696ebefde323f5b791269ad0c57f3f99d9 (master, 6 November 2026),
// src/resources/theme/{color/{core,semantic,wa,color},typography,core}.globals.ts,
// src/components/{ha-button,ha-switch}.ts. Public variables are documented at
// https://www.home-assistant.io/integrations/frontend/ ; other variables are
// compatibility mappings, not a promise that HA's private DOM will remain stable.
const common = {
  'civica-theme': '1',
  'ha-font-family-body': 'Arial, Helvetica, sans-serif',
  'ha-font-family-heading': 'Arial, Helvetica, sans-serif',
  'ha-font-family-longform': 'Arial, Helvetica, sans-serif',
  'ha-font-family-code': "'Courier New', monospace",
  'paper-font-body1_-_font-family': 'Arial, Helvetica, sans-serif',
  'paper-font-common-base_-_font-family': 'Arial, Helvetica, sans-serif',
  'mdc-typography-font-family': 'Arial, Helvetica, sans-serif',
  // Native HA geometry uses a compact 16px body. Custom civica components use
  // 19px body / 16px support text. Retain HA's user-adjustable font-size scale.
  'civica-font-size-body': 'calc(19px * var(--ha-font-size-scale, 1))',
  'civica-font-size-small': 'calc(16px * var(--ha-font-size-scale, 1))',
  'civica-font-size-heading': 'calc(24px * var(--ha-font-size-scale, 1))',
  'ha-font-size-xs': 'calc(12px * var(--ha-font-size-scale, 1))',
  'ha-font-size-s': 'calc(14px * var(--ha-font-size-scale, 1))',
  'ha-font-size-m': 'calc(16px * var(--ha-font-size-scale, 1))',
  'ha-font-size-l': 'calc(19px * var(--ha-font-size-scale, 1))',
  'ha-font-weight-body': '400', 'ha-font-weight-normal': '400',
  'ha-font-weight-heading': '700', 'ha-font-weight-bold': '700',
  'ha-font-weight-action': '400', 'ha-font-weight-medium': '400',
  'ha-line-height-normal': '1.5', 'ha-line-height-condensed': '1.25',
  'ha-card-header-font-family': 'Arial, Helvetica, sans-serif',
  'ha-card-header-font-size': 'var(--civica-font-size-heading)', 'ha-card-header-color': 'var(--primary-text-color)',
  // Native hui-heading-card titles otherwise fall back to 19px normal weight,
  // placing dashboard section H2s below the card titles they introduce.
  'ha-heading-card-title-font-size': 'var(--civica-font-size-heading)',
  'ha-heading-card-title-font-weight': '700', 'ha-heading-card-title-line-height': '1.25',
  'ha-card-border-radius': '0px', 'ha-card-border-width': '1px', 'ha-card-box-shadow': 'none',
  'ha-button-border-radius': '0px', 'ha-button-height': '44px',
  'ha-dialog-border-radius': '0px', 'ha-picture-border-radius': '0px', 'ha-picture-border-radius-sm': '0px',
  'ha-border-radius-square': '0px',
  // Preserve the entire native radius scale. HA's notification badge uses xl
  // (and md when collapsed), not circle/pill. Shape is a component decision:
  // cards, fields, buttons and dialogs are squared above, not every HA element.
  'ha-border-width-sm': '1px', 'ha-border-width-md': '2px', 'ha-border-width-lg': '3px',
  'ha-switch-size': '28px', 'ha-switch-thumb-size': '20px', 'ha-switch-width': '48px',
  'ha-switch-min-touch-size': '44px', 'ha-switch-thumb-box-shadow': 'none',
  'mdc-shape-small': '0px', 'mdc-shape-medium': '0px', 'mdc-shape-large': '0px',
  'mdc-button-outline-width': '2px', 'wa-form-control-border-width': '2px',
  'wa-form-control-border-radius': '0px', 'wa-panel-border-radius': '0px',
  'ha-color-focus': FOCUS, 'wa-focus-ring-width': '3px', 'wa-focus-ring-offset': '2px',
  'wa-focus-ring-style': 'solid', 'wa-focus-ring': '3px solid var(--wa-focus-ring-color)',
  'civica-focus-text': INK, 'civica-focus-background': FOCUS,
  'civica-danger-fill': SEMANTIC.danger, 'civica-on-danger': WHITE,
  'civica-success-fill': SEMANTIC.success, 'civica-on-success': WHITE,
  'civica-warning-fill': FOCUS, 'civica-on-warning': INK,
  'civica-notice-fill': INK, 'civica-on-notice': WHITE,
  // MOJ notification-badge geometry and fixed semantic red. These do not vary
  // with brand palette or dark mode. The sidebar adapter owns count semantics.
  // https://design-patterns.service.justice.gov.uk/components/notification-badge/
  'civica-notification-badge-background': '#CA3535',
  'civica-notification-badge-color': WHITE,
  'civica-notification-badge-border-radius': '10em',
  'civica-notification-badge-font-size': 'calc(16px * var(--ha-font-size-scale, 1))',
  'civica-notification-badge-font-weight': '700',
  'civica-notification-badge-line-height': '1.25',
  'civica-notification-badge-min-width': '.75em',
  'civica-notification-badge-min-height': '1.25em',
  'civica-notification-badge-padding': '1px .25em 0',
  'civica-notification-badge-margin-left': '.5em',
  'civica-notification-badge-outline': '4px solid var(--civica-notification-badge-background)',
  'civica-notification-badge-outline-offset': '-.1em',
  'civica-navigation-icon-masthead-color': WHITE,
  'ha-color-white': WHITE, 'ha-color-black': INK, 'white-color': WHITE, 'black-color': INK,
};

function paletteScale(primary) {
  const steps = { '05': -0.85, '10': -0.70, '20': -0.50, '30': -0.20, '40': 0, '50': 0.25, '60': 0.45, '70': 0.65, '80': 0.80, '90': 0.90, '95': 0.95 };
  return Object.fromEntries(Object.entries(steps).map(([step, value]) => [`ha-color-primary-${step}`, mix(primary, value < 0 ? INK : WHITE, Math.abs(value))]));
}

function roleTokens(role, source, dark) {
  const on = dark ? mix(source, WHITE, 0.72) : mix(source, INK, 0.25);
  const quiet = dark ? mix(source, INK, 0.78) : mix(source, WHITE, 0.96);
  const normal = dark ? mix(source, INK, 0.62) : mix(source, WHITE, 0.90);
  const normalHover = dark ? mix(source, INK, 0.48) : mix(source, WHITE, 0.82);
  const loud = dark ? mix(source, WHITE, 0.72) : source;
  const loudHover = dark ? mix(source, WHITE, 0.82) : mix(source, INK, 0.20);
  const out = {};
  for (const [volume, resting, hover] of [['quiet', quiet, normal], ['normal', normal, normalHover], ['loud', loud, loudHover]]) {
    for (const [state, value] of [['resting', resting], ['hover', hover], ['active', resting]]) out[`ha-color-fill-${role}-${volume}-${state}`] = value;
    out[`ha-color-on-${role}-${volume}`] = volume === 'loud' ? (dark ? INK : WHITE) : on;
    // Quiet borders group content. Normal/loud borders identify controls.
    // Mapping every volume to the text colour makes ordinary cards look like
    // input fields; neutral structural borders are resolved explicitly below.
    out[`ha-color-border-${role}-${volume}`] = volume === 'quiet' ? mix(source, dark ? INK : WHITE, 0.50) : on;
  }
  return out;
}

export function modeTokens(palette, tone, dark) {
  const primary = palette[tone].primary.hex;
  const suppliedCanvas = palette[tone].canvas.hex;
  const canvas = dark ? '#17191B' : suppliedCanvas;
  const surface = dark ? '#24282B' : WHITE;
  const secondarySurface = dark ? '#30363A' : '#F3F2F1';
  const text = dark ? WHITE : INK;
  const secondary = dark ? '#CBD0D3' : '#484949';
  const quietBorder = dark ? '#50565A' : '#CECECE';
  const interactiveBorder = dark ? '#9BA4AA' : '#6F777B';
  const active = dark ? mix(primary, WHITE, 0.72) : primary;
  const hover = dark ? mix(primary, WHITE, 0.82) : mix(primary, INK, 0.20);
  const onActive = dark ? INK : WHITE;
  const navigationActive = dark ? active : mix(primary, INK, 0.25);
  const colours = Object.fromEntries(Object.entries(SEMANTIC).map(([key, value]) => [key, dark ? mix(value, WHITE, 0.72) : value]));
  const tokens = {
    'civica-palette': palette.id, 'civica-tone': tone,
    'civica-brand-primary': primary, 'civica-brand-canvas': suppliedCanvas,
    'civica-canvas': canvas, 'civica-surface': surface,
    'civica-border-quiet': quietBorder, 'civica-border-interactive': interactiveBorder,
    'civica-input-border': text,
    'civica-navigation-icon-color': secondary,
    'civica-navigation-icon-active-color': navigationActive,
    'civica-action': active, 'civica-action-hover': hover, 'civica-on-action': onActive,
    'primary-color': active, 'dark-primary-color': hover, 'darker-primary-color': hover,
    'light-primary-color': dark ? mix(primary, WHITE, 0.82) : mix(primary, WHITE, 0.90),
    'accent-color': active, 'link-color': active,
    'primary-text-color': text, 'secondary-text-color': secondary,
    'text-primary-color': onActive, 'text-light-primary-color': text, 'disabled-text-color': secondary,
    'ha-color-text-primary': text, 'ha-color-text-secondary': secondary,
    'ha-color-text-disabled': secondary, 'ha-color-text-link': active,
    'ha-color-text-primary-inverted': dark ? INK : WHITE,
    'ha-color-text-secondary-inverted': dark ? '#484949' : '#CBD0D3',
    'primary-background-color': canvas, 'secondary-background-color': secondarySurface,
    'clear-background-color': surface, 'card-background-color': surface, 'ha-card-background': surface,
    'lovelace-background': canvas, 'ha-panel-background': canvas,
    'ha-panel-toolbar-background': canvas, 'ha-data-table-background': surface,
    'ha-dialog-surface-background': surface,
    'ha-color-surface-default': surface, 'ha-color-surface-low': canvas,
    'ha-color-surface-lower': secondarySurface, 'ha-color-on-surface-default': text,
    'ha-color-surface-default-inverted': dark ? WHITE : '#24282B',
    'ha-color-surface-low-inverted': dark ? '#F3F2F1' : '#17191B',
    'ha-color-surface-lower-inverted': dark ? '#E4E7E9' : INK,
    'ha-card-border-color': quietBorder, 'divider-color': quietBorder,
    'outline-color': interactiveBorder,
    'outline-hover-color': text, 'shadow-color': 'transparent', 'scrollbar-thumb-color': secondary,
    // The native outline has one colour; use ink on light surfaces and yellow on dark.
    // Custom civica controls use the yellow/ink two-colour focus treatment.
    'wa-focus-ring-color': dark ? FOCUS : INK,
    'error-color': colours.danger, 'warning-color': colours.warning,
    'success-color': colours.success, 'info-color': colours.info,
    'state-icon-color': text, 'state-active-color': active, 'state-inactive-color': secondary,
    'state-unavailable-color': secondary, 'state-icon-error-color': colours.danger,
    // Keep the fixed MOJ notification red distinct from the sidebar in dark
    // mode: the existing dark canvas gives >3:1, whereas the raised card surface
    // gives only 2.88:1. Do not recolour the badge to match a brand palette.
    'sidebar-background-color': dark ? canvas : surface, 'sidebar-text-color': text, 'sidebar-icon-color': secondary,
    'sidebar-menu-button-background-color': primary, 'sidebar-menu-button-text-color': WHITE,
    'sidebar-selected-background-color': dark ? '#30363A' : '#E8EEF3',
    'sidebar-selected-text-color': navigationActive,
    'sidebar-selected-icon-color': navigationActive,
    'app-header-background-color': primary, 'app-header-text-color': WHITE,
    'app-theme-color': primary,
    'app-header-border-bottom': `4px solid ${primary}`,
    'ha-color-form-background': surface, 'ha-color-form-background-hover': secondarySurface,
    'ha-color-form-background-disabled': secondarySurface,
    'input-fill-color': surface, 'input-ink-color': text, 'input-label-ink-color': text,
    'input-idle-line-color': text, 'input-hover-line-color': text,
    'input-disabled-line-color': secondary, 'input-disabled-fill-color': secondarySurface,
    'input-disabled-ink-color': secondary, 'input-outlined-idle-border-color': text,
    'input-outlined-hover-border-color': text, 'input-outlined-disabled-border-color': secondary,
    'input-dropdown-icon-color': text,
    'wa-form-control-background-color': surface, 'wa-form-control-border-color': text,
    'wa-form-control-value-color': text, 'wa-form-control-placeholder-color': secondary,
    'mdc-checkbox-unchecked-color': text, 'mdc-checkbox-disabled-color': secondary,
    'mdc-radio-unchecked-color': text, 'mdc-radio-disabled-color': secondary,
    'mdc-ripple-color': active,
    'ha-switch-background-color': surface, 'ha-switch-background-color-hover': secondarySurface,
    'ha-switch-border-color': text, 'ha-switch-thumb-background-color': text,
    'ha-switch-thumb-background-color-hover': text, 'ha-switch-thumb-border-color': text,
    'ha-switch-thumb-border-color-hover': text,
    'ha-switch-checked-background-color': active, 'ha-switch-checked-background-color-hover': hover,
    'ha-switch-checked-border-color': active, 'ha-switch-checked-border-color-hover': hover,
    'ha-switch-checked-thumb-background-color': onActive, 'ha-switch-checked-thumb-background-color-hover': onActive,
    'ha-switch-checked-thumb-border-color': onActive, 'ha-switch-checked-thumb-border-color-hover': onActive,
    'switch-checked-color': active, 'switch-checked-button-color': onActive, 'switch-checked-track-color': active,
    'switch-unchecked-color': text, 'switch-unchecked-button-color': text, 'switch-unchecked-track-color': surface,
    'slider-color': active, 'slider-secondary-color': interactiveBorder, 'slider-track-color': interactiveBorder,
    'paper-slider-knob-color': active, 'paper-slider-active-color': active,
    'mdc-dialog-heading-ink-color': text, 'mdc-dialog-content-ink-color': text,
    'mdc-dialog-scroll-divider-color': quietBorder, 'mdc-tab-text-label-color-default': text,
    'mdc-theme-primary': active, 'mdc-theme-secondary': active, 'mdc-theme-error': colours.danger,
    'mdc-theme-surface': surface, 'mdc-theme-background': canvas,
    'mdc-theme-on-primary': onActive, 'mdc-theme-on-secondary': onActive,
    'mdc-theme-on-surface': text, 'mdc-theme-on-error': dark ? INK : WHITE,
    'red-color': colours.danger, 'green-color': colours.success, 'blue-color': colours.info,
    'yellow-color': dark ? '#FFE56B' : '#8A6100', 'orange-color': colours.warning,
    'purple-color': dark ? '#D9BFE8' : '#7D4A9A', 'pink-color': dark ? '#F4BCD3' : '#A73469',
    'brown-color': dark ? '#DFC5B3' : '#6B4C3B', 'teal-color': dark ? '#A8DFDB' : '#007F7B',
    'grey-color': secondary, 'dark-grey-color': secondary, 'light-grey-color': quietBorder,
    'label-badge-red': colours.danger, 'label-badge-green': colours.success,
    'label-badge-blue': colours.info, 'label-badge-yellow': colours.warning, 'label-badge-grey': secondary,
    ...roleTokens('primary', primary, dark),
    ...roleTokens('neutral', '#484949', dark),
    ...roleTokens('danger', SEMANTIC.danger, dark),
    ...roleTokens('warning', SEMANTIC.warning, dark),
    ...roleTokens('success', SEMANTIC.success, dark),
    // Separate decorative divisions from controls; do not weaken input/focus
    // boundaries to satisfy the visually quieter card treatment.
    'ha-color-border-neutral-quiet': quietBorder,
    'ha-color-border-neutral-normal': interactiveBorder,
    'ha-color-border-neutral-loud': text,
    'wa-color-surface-border': quietBorder,
    'wa-color-neutral-border-quiet': quietBorder,
    'wa-color-neutral-border-normal': interactiveBorder,
    'wa-color-neutral-border-loud': text,
  };
  // Web Awesome uses this core-token shortcut rather than the semantic border.
  // Resolve it explicitly so dark charcoal variants retain a visible outline.
  tokens['wa-color-brand-border-normal'] = tokens['ha-color-border-primary-normal'];
  for (const prefix of ['mdc-text-field', 'mdc-select']) {
    for (const [key, value] of Object.entries({ 'fill-color': surface, 'ink-color': text, 'label-ink-color': text, 'idle-line-color': text, 'hover-line-color': text, 'outlined-idle-border-color': text, 'outlined-hover-border-color': text, 'dropdown-icon-color': text })) tokens[`${prefix}-${key}`] = value;
  }
  for (const volume of ['quiet', 'normal', 'loud']) {
    tokens[`ha-color-on-disabled-${volume}`] = secondary;
    for (const state of ['resting', 'hover']) tokens[`ha-color-fill-disabled-${volume}-${state}`] = secondarySurface;
  }
  const energy = ['grid-consumption', 'gas', 'non-fossil', 'grid-return', 'solar', 'water', 'battery-in', 'battery-out'];
  const chartContext = { tone, mode: dark ? 'dark' : 'light' };
  tokens['civica-chart-tone'] = tone;
  tokens['civica-chart-mode'] = chartContext.mode;
  // The first eight variables retain their semantic compatibility mapping.
  // Additional fallback slots are generated, not a cap on identity-based data.
  for (let i = 0; i < 24; i++) {
    const role = energy[i] || (i === 8 ? 'consumption' : `series-${i + 1}`);
    const colour = chartColour(role, chartContext);
    tokens[`civica-chart-${i + 1}`] = colour;
    tokens[`color-${i + 1}`] = colour;
    if (energy[i]) tokens[`energy-${energy[i]}-color`] = colour;
  }
  tokens['energy-consumption-color'] = chartColour('consumption', chartContext);
  for (const key of ['primary-color', 'accent-color', 'primary-text-color', 'secondary-text-color', 'text-primary-color', 'card-background-color', 'error-color', 'warning-color', 'success-color', 'info-color']) tokens[`rgb-${key}`] = rgb(tokens[key]).join(', ');
  return tokens;
}

export function buildTheme(palette, tone, name = themeName(palette, tone)) {
  return {
    ...common, ...paletteScale(palette[tone].primary.hex),
    'card-mod-theme': name,
    'card-mod-card-yaml': '.: |\n  ha-card { border: 1px solid var(--ha-card-border-color); border-radius: 0; box-shadow: none; }\n  ha-card:focus-visible { outline: 3px solid var(--civica-focus-text); outline-offset: 3px; box-shadow: 0 0 0 3px var(--ha-color-focus); }\n',
    modes: { light: modeTokens(palette, tone, false), dark: modeTokens(palette, tone, true) },
  };
}

export function allThemes() {
  return Object.fromEntries(palettes.palettes.flatMap((palette) => palettes.tones.map((tone) => [themeName(palette, tone), buildTheme(palette, tone)])));
}

function yaml(object, indent = 0) {
  return Object.entries(object).map(([key, value]) => `${' '.repeat(indent)}${JSON.stringify(key)}:${typeof value === 'object' ? '\n' + yaml(value, indent + 2) : ' ' + JSON.stringify(value) + '\n'}`).join('');
}

export function generatedFiles() {
  const themes = allThemes();
  const defaultPalette = palettes.palettes.find((palette) => palette.id === palettes.defaultPalette);
  const comment = '# Generated by scripts/generate-themes.mjs. Edit design-system/palettes.json and the generator.\n# Vivid/muted are independent of light/dark. See docs/source/styles/colour.html.md.\n';
  return {
    'themes/civica.yaml': comment + yaml(themes),
    'themes/govuk.yaml': comment + '# Migration alias only. Select a civica theme for new installations.\n' + yaml({ govuk: buildTheme(defaultPalette, palettes.defaultTone, 'govuk') }),
    'design-system/themes.json': JSON.stringify({ schemaVersion: 1, generated: true, themes }, null, 2) + '\n',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = false;
  for (const [path, content] of Object.entries(generatedFiles())) {
    if (check) {
      let current;
      try { current = readFileSync(new URL(path, root), 'utf8'); } catch { current = ''; }
      if (current !== content) { console.error(`Out of date: ${path}`); stale = true; }
    } else writeFileSync(new URL(path, root), content);
  }
  if (stale) process.exitCode = 1;
  else console.log(check ? 'Theme outputs are current (20 variants and migration alias).' : 'Generated 20 civica themes and the govuk migration alias.');
}
