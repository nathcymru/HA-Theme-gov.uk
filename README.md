# civica.uk for Home Assistant

A consistent Home Assistant theme and component system inspired by the GOV.UK Design System, using the supplied **civica.uk** identity. Ten palettes, Vivid and Muted tones, accessible light and dark modes, and an optional colour toggle beside Home Assistant's theme settings.

This is an independent project. It is not a government service or an official Home Assistant product. The repository name and existing `govuk` entity IDs remain compatible with older installations.

## Start with the design system

The comprehensive [design system in `/docs`](docs/README.md) uses the **GOV.UK Tech Docs Template (`govuk_tech_docs` 6.6.0), powered by Middleman**. Its Get started, Styles, Components, Patterns, Community and Accessibility sections follow the official GOV.UK Design System's information architecture. That upstream website uses Node; this site deliberately implements the same organisation with the requested Middleman template.

- [Live design system](https://nathcymru.github.io/HA-Theme-gov.uk/)
- [Download the installation package](https://github.com/nathcymru/HA-Theme-gov.uk/releases/latest)
- [Install and upgrade](docs/source/get-started/install.html.md)
- [Colour palettes and display modes](docs/source/styles/colour.html.md)
- [Brand and artwork](ARTWORK.md)
- [AI reading guide](docs/source/llms.txt)
- [Canonical palette data](design-system/palettes.json) and [resolved theme variables](design-system/themes.json)

## Included

- **20 native themes:** Civic Cobalt, Racing Moss, Imperial Damson, Sovereign Crimson, Regimental Plum, Oxford Midnight, Ink Charcoal, Heritage Ochre, Kiln Terracotta and Umber Bronze, each in Vivid and Muted tones.
- **One shared token system:** native panels, dashboards, tables, forms, buttons, switches, dialogs, the lighting card and examples use consistent colours and surfaces. Error, warning and chart meanings stay independent of the selected brand palette.
- **Colour controls:** a palette selector and “Use muted colours” toggle beside Profile theme settings, plus a dashboard card fallback. Home Assistant handles application and preference storage. Light/Dark/Auto is preserved.
- **civica.uk assets:** supplied logos and icons, used without redrawing or recolouring. Original files and their checksum manifest are retained.
- **Lighting card repairs:** visible unavailable states, accessible errors, keyboard focus, touch targets, responsive layout and native dialog scrolling. Existing lighting automation and reserved-device behaviour are retained.

Vivid/Muted is separate from Light/Dark. The supplied light canvases are exact. Dark mode uses documented, tested colour adaptations while retaining the supplied primary colour in the header.

## Install the themes

With HACS, add `https://github.com/nathcymru/HA-Theme-gov.uk` as a custom repository of type **Theme**, then download **civica.uk for Home Assistant**. HACS installs the YAML themes; it does not install the optional companion or lighting card.

For manual installation, copy `themes/civica.yaml` to your Home Assistant `config/themes/civica/` directory. Keep `themes/govuk.yaml` there only if an existing profile or dashboard uses the old `govuk` theme name. That alias now maps to Civic Cobalt Vivid.

Merge this into your existing `configuration.yaml` without duplicating `frontend`:

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

Restart after changing `configuration.yaml`. For theme-file changes alone, run **Developer tools → Actions → `frontend.reload_themes`**. In your **Profile**, choose `civica Civic Cobalt Vivid` or another civica theme. The native selector works without extra JavaScript.

## Add the colour toggle and branding

Download `civica-home-assistant.zip` from the [latest release](https://github.com/nathcymru/HA-Theme-gov.uk/releases/latest), or build it with `npm ci && npm run package`. Extract the archive. Copy the archive's `www/civica/` folder into Home Assistant's `config/www/civica/` and its `themes/civica/` into `config/themes/civica/`.

Add the companion to the same frontend configuration:

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/civica/civica-ui.js?v=1.1.0
```

Restart Home Assistant and reload the browser. In **Profile → Theme**, choose a palette and toggle **Use muted colours**. The companion uses the same `settheme` event as Home Assistant's own selector. It clears native primary/accent overrides so the palette applies consistently, and leaves display mode unchanged. Home Assistant reports preference-save failures through its native notification.

The companion adds civica.uk branding to the authenticated sidebar and browser icons while a civica theme is selected. Switching to another theme restores the original elements. It does not replace Home Assistant's login, installed PWA manifest, native app icon or splash screen.

If a future Home Assistant update changes the Profile layout, use the native theme dropdown or add this dashboard card:

```yaml
type: custom:civica-theme-settings
```

The Profile adapter is a small, version-sensitive enhancement. The themes themselves remain independent of it. No global theme-changing helper or device automation is required.

## Lighting card and examples

Register `/local/civica/card/dist/govuk-house-lighting-card.js?v=1.1.0` as a **JavaScript module** in your dashboard resources, then use `type: custom:civica-house-lighting-card`. The old `custom:govuk-house-lighting-card` name remains available. Keep its adjacent `card/assets/` directory in the packaged layout. See [lighting setup](lighting/README.md) for the required room groups and automation package before using device controls.

[Card examples](cards/) require card-mod where stated. The confirmation example is shown only when `input_boolean.civica_action_confirmed` is on; set that helper from a verified completed action. Do not display a successful outcome merely because a button was pressed. Emergency banner IDs remain compatible with earlier installs, but their examples are not a safety monitoring system.

## Develop and verify

Node.js 22 or later and Python 3 are required for development. The documentation uses Ruby 3.3 and Bundler.

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run check:brand
# Build docs as described below before running the complete browser suite.
npm run docs:build
npm run test:browser
npm run package
```

Browser tests use installed Google Chrome on macOS and Playwright Chromium on Linux (`npx playwright install --with-deps chromium`). To check the existing automation YAML and templates, install `PyYAML` and `Jinja2` in a virtual environment and run `npm run check:ha`.

```sh
cd docs
bundle install
bundle exec middleman build
bundle exec middleman server
```

`npm run generate:themes` regenerates YAML and resolved JSON from the palette specification. Tests fail if committed outputs drift. `python3 scripts/contrast.py` remains a compatibility entry point for the palette contrast checks.

## Verification boundary

Automated tests cover generated values, colour contrast, component behaviour, keyboard operation, small-screen reflow, asset integrity and the built documentation. Browser fixtures simulate Home Assistant; they are not evidence of a live deployment. Native Energy, Map, device editors, authentication and third-party cards remain Home Assistant features. A YAML theme cannot rewrite their behaviour or guarantee every private component's appearance. The documentation records the compatibility boundary and a live acceptance matrix rather than claiming whole-product accessibility certification.

## Licence

Original work supplied in this copy: [civica Free Use Licence 1.0](LICENSE). Earlier permissions and separately licensed artwork remain unchanged. Upstream design guidance retains its stated attribution. Supplied and pre-existing artwork has separate [provenance and reuse terms](ARTWORK.md). No official GOV.UK brand assets or GDS Transport fonts are distributed in the deployable output.

## Licence update on 13 November 2026

This offered copy uses the civica Free Use Licence 1.0 for covered original work: free personal and internal business use, with no sale, paid access, paid bundles or paid services involving that work. Earlier permissions and third-party terms remain unchanged. Read [the release-specific licence and attribution](LICENSE.md).
