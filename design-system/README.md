# civica.uk design tokens

`palettes.json` is the canonical, human- and machine-readable colour specification. It preserves the 10 palettes supplied on 11 November 2026, their vivid and muted primary/canvas pairs, and the supplied RGB, RGBA, CMYK and RAL or descriptive references. Hex values in the sRGB colour space govern screens. The print references are reproduced as supplied, not certified colour matches.

`themes.json` is generated, resolved Home Assistant theme data for previews and automated checks. Each entry contains common variables and separate `modes.light` and `modes.dark` objects. Merge a mode over its common variables when using it in a browser preview; do not apply the `modes` object as CSS.

Run `npm run generate:themes` after editing palette data or `scripts/generate-themes.mjs`. The generator writes 20 entries to `themes/civica.yaml` and a compatibility-only `govuk` entry to `themes/govuk.yaml`. Use `node scripts/generate-themes.mjs --check` to detect stale generated files and `node --test test/themes.test.mjs` to check the colour contracts.

## Selection contract

- Palette IDs are stable, lower-case, hyphen-separated strings, for example `civic-cobalt`.
- Tones are `vivid` and `muted`; they are independent of Home Assistant's `light`, `dark` and automatic mode preference.
- Native theme names use the form `civica {palette name} {Vivid|Muted}`, for example `civica Civic Cobalt Vivid`.
- `govuk` is a migration alias for Civic Cobalt Vivid. It does not use official branding.
- Light mode uses the exact supplied primary and canvas. Dark mode derives lighter interaction colours and uses neutral dark surfaces. It keeps the supplied primary as `civica-brand-primary`, the app header and sidebar masthead colour.

## Roles and controlled adaptations

Brand colour changes must not change the meaning of errors, warnings, success, unavailable devices or chart series. The error and success base colours are `#CA3535` and `#0F7A52`, following the current GOV.UK Frontend 6.6 values. Secondary light text is `#484949`. Warning text uses dark ochre `#8A6100` so it remains readable on light surfaces; warning bands use yellow `#FFDD00` with ink text. This is a civica adaptation, not an official new GOV.UK token.

The `civica-danger-fill`, `civica-success-fill`, `civica-warning-fill` and `civica-notice-fill` tokens have explicit `civica-on-*` foregrounds. Use those pairs for persistent banners and destructive buttons. Do not assume white text is readable on `error-color` in dark mode: that variable is an accessible lighter text/icon colour.

For custom controls, combine `ha-color-focus` yellow with `civica-focus-text` ink. Many native HA controls expose only one outline colour; `wa-focus-ring-color` is therefore ink on light surfaces and yellow on dark surfaces. The companion scopes yellow focus to the dark brand masthead. Yellow alone on a white canvas is not an adequate focus indicator.

Square card, field, button and dialog corners follow the service design language. Native circle and pill tokens are retained for radio buttons, switches, avatars and gauges. Dialog widths and heights are not forced globally: users must still be able to read and scroll long dialogs at zoomed and mobile sizes.

Eight chart colours stay fixed across palettes, with separate light/dark values. They meet 3:1 against the card surface. This does not establish that adjacent series are distinguishable from each other. Direct labels, units, alternative tables, patterns or strokes remain necessary; a theme cannot add these to native charts. Charts with more than eight series should be simplified or separately reviewed.

## Compatibility evidence

The generator covers modern HA semantic tokens, legacy/MDC tokens, switches, forms, buttons, native panel/table backgrounds, cards, the app header and sidebar. The upstream implementation was read at Home Assistant frontend commit [`e32bc0696ebefde323f5b791269ad0c57f3f99d9`](https://github.com/home-assistant/frontend/tree/e32bc0696ebefde323f5b791269ad0c57f3f99d9), dated 6 November 2026. The exact sources are listed in `upstream-sources.json`.

Home Assistant's [frontend documentation](https://www.home-assistant.io/integrations/frontend/) distinguishes supported variables from compatibility variables that can change between releases. A successful token test is not a live browser acceptance test. Check native screens and third-party cards against the documented acceptance matrix after each HA frontend update.
