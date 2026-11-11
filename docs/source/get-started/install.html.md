---
title: "Install civica.uk"
description: "Install civica.uk for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Install civica.uk

Back up your current theme configuration before replacing an existing installation. Keep your existing dashboards and integrations.

Choose **HACS or manual installation** to own the theme YAML. Keep each theme name, including the `govuk` compatibility alias, defined only once across the included themes directory.

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

HACS's Theme category installs and updates the YAML in its repository folder under `/config/themes/`. An existing installation may use `/config/themes/govuk/`; keep that HACS-managed location. HACS does not install the optional JavaScript module or image files automatically. When adding those from the release archive, copy only `www/civica/`, not a second set of themes.

## Download or build the installation archive

Download `civica-home-assistant.zip` and its checksum from the [latest release](https://github.com/nathcymru/HA-Theme-gov.uk/releases/latest).

To build an installation archive from this checkout, run these commands from the repository root:

```sh
npm ci
npm run package
```

The archive is `dist/civica-home-assistant.zip`. Its `README.md` gives the complete installation instructions. To include the rendered documentation site, build `/docs` before packaging.

## Install the optional interface module

Extract the archive. Copy its `www/civica/` directory into `/config/www/civica/`, preserving the complete structure. The module, lighting bundle and assets need their relative paths intact.

**If HACS manages the theme, do not copy the archive's `themes/` directory.** Use HACS to update its installed theme files. If you use manual installation, follow the manual steps below and maintain that one theme location.

Add the module to the existing `frontend:` section:

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/civica/civica-ui.js?v=1.1.1
```

Restart Home Assistant after a configuration check and reload the browser. The module adds civica.uk settings beside Home Assistant's theme settings. From a non-civica theme, choose a palette to start using civica.uk. It also provides the dashboard settings card.

Use `extra_module_url` for global loading. Loading only a dashboard resource can leave settings and native panels untreated until that dashboard has been opened.

## Optional lighting card

Configure the lighting package and room groups described in `lighting/README.md` before using the lighting card. The included room and automation examples are installation-specific; review them for your home.

Add `/local/civica/card/dist/govuk-house-lighting-card.js?v=1.1.1` as a JavaScript module dashboard resource. Use `type: custom:civica-house-lighting-card`. The old filename and `custom:govuk-house-lighting-card` type remain for compatibility.

The artwork is served from `/local/civica/card/assets/`. Do not install the separate front-door automation example merely to apply the theme.

## Manual theme installation

Use these steps only when HACS does not manage this theme. Copy the archive's `themes/civica/` into `/config/themes/civica/` once. From a repository checkout, copy `themes/civica.yaml` into that directory instead. These are alternative sources for the same generated themes. For later updates, replace the files in the same location rather than adding another folder.

Keep `govuk.yaml` only if an existing profile or dashboard uses the old `govuk` theme name. It maps to Civic Cobalt Vivid. Replace or retire an existing alias as part of the same installation; do not add a second included `govuk` definition. Choose a named civica theme for the new palette controls. Load and select it as described above.

## Resolve duplicate theme definitions

If borders, colours or other theme variables remain from an older release after reloading, check for more than one included copy before treating the result as a browser cache issue.

1. Inspect all YAML files under the directory loaded by `!include_dir_merge_named themes`. Look for repeated `civica …` names and the `govuk` alias. A HACS file such as `/config/themes/govuk/civica.yaml` and a manual file such as `/config/themes/civica/civica.yaml` define the same themes.
2. Choose one installation owner. For HACS, update the repository through HACS and retain its managed files. For manual ownership, remove this repository from HACS so a later HACS update cannot recreate a duplicate, then retain the manual location.
3. Back up the superseded civica YAML **outside** the included themes directory, for example `/config/civica-theme-backups/`. Move only the superseded civica files or definitions; preserve unrelated themes. Renaming a folder to `backup` inside `/config/themes/` does not exclude its YAML from loading.
4. Confirm each civica theme and the optional `govuk` alias has one included definition. Run `frontend.reload_themes`, reload the browser and select the theme again. Check that the current release's colours and structural borders appear.

Keep theme and runtime updates aligned: HACS owns YAML updates; the archive's `www/civica/` supplies the matching interface module and assets.

## Add settings to a dashboard

With the interface module loaded, add a manual card:

```yaml
type: custom:civica-theme-settings
```

This is also the fallback when an updated Home Assistant profile layout prevents automatic placement of the controls.

## Remove the theme

Select a built-in or other theme first. Remove the module's `extra_module_url` entry, restart, and reload. Remove civica.uk files only after checking that no dashboards or theme selectors still reference them. Existing device entities and automations are not changed by selecting a theme.

Home Assistant documents theme loading and frontend configuration in its [Frontend integration reference](https://www.home-assistant.io/integrations/frontend/).
