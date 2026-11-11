---
title: "Install civica.uk"
description: "Install civica.uk for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Install civica.uk

Back up your current theme configuration before replacing an existing installation. Keep your existing dashboards and integrations.

## Install the theme with HACS

1. Open **HACS** in Home Assistant.
2. Add `https://github.com/nathcymru/HA-Theme-gov.uk` as a custom repository with category **Theme**.
3. Download the theme repository.
4. Make sure your `configuration.yaml` loads the themes directory:

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

If `frontend:` already exists, add `themes:` to that section. Do not create a second `frontend:` key.

Run the `frontend.reload_themes` action, or restart Home Assistant after a configuration check. Open your profile and select a theme such as **civica Civic Cobalt Vivid**.

HACS's Theme category installs the theme files. It does not install the optional JavaScript module or image files automatically.

## Download or build the installation archive

Download `civica-home-assistant.zip` and its checksum from the [latest release](https://github.com/nathcymru/HA-Theme-gov.uk/releases/latest).

To build an installation archive from this checkout, run these commands from the repository root:

```sh
npm ci
npm run package
```

The archive is `dist/civica-home-assistant.zip`. Its `README.md` gives the complete installation instructions. To include the rendered documentation site, build `/docs` before packaging.

## Install the optional interface module

Extract the archive. Copy its `www/civica/` directory into `/config/www/civica/`, preserving the complete structure. Copy its `themes/civica/` into `/config/themes/civica/`. The module, lighting bundle and assets need their relative paths intact.

Add the module to the existing `frontend:` section:

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/civica/civica-ui.js?v=1.1.0
```

Restart Home Assistant after a configuration check and reload the browser. The module adds civica.uk settings beside Home Assistant's theme settings. From a non-civica theme, choose a palette to start using civica.uk. It also provides the dashboard settings card.

Use `extra_module_url` for global loading. Loading only a dashboard resource can leave settings and native panels untreated until that dashboard has been opened.

## Optional lighting card

Configure the lighting package and room groups described in `lighting/README.md` before using the lighting card. The included room and automation examples are installation-specific; review them for your home.

Add `/local/civica/card/dist/govuk-house-lighting-card.js?v=1.1.0` as a JavaScript module dashboard resource. Use `type: custom:civica-house-lighting-card`. The old filename and `custom:govuk-house-lighting-card` type remain for compatibility.

The artwork is served from `/local/civica/card/assets/`. Do not install the separate front-door automation example merely to apply the theme.

## Manual theme installation

Copy the generated theme YAML from `themes/` into your Home Assistant themes directory. Load and select it as described above. The `govuk` theme name remains a compatibility entry for existing configurations; choose a named civica theme for the new palette controls.

## Add settings to a dashboard

With the interface module loaded, add a manual card:

```yaml
type: custom:civica-theme-settings
```

This is also the fallback when an updated Home Assistant profile layout prevents automatic placement of the controls.

## Remove the theme

Select a built-in or other theme first. Remove the module's `extra_module_url` entry, restart, and reload. Remove civica.uk files only after checking that no dashboards or theme selectors still reference them. Existing device entities and automations are not changed by selecting a theme.

Home Assistant documents theme loading and frontend configuration in its [Frontend integration reference](https://www.home-assistant.io/integrations/frontend/).
