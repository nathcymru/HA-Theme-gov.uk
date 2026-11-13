# Install civica.uk for Home Assistant

This package contains themes, the optional colour controls and branding companion, the lighting card, its assets and lighting setup files. It does not change your Home Assistant configuration automatically.

1. Choose one owner for the theme YAML. **With HACS**, install or update the theme through HACS and skip this archive's `themes/` directory. HACS owns its folder under `config/themes/`, which may be named `govuk` in an existing installation. **Without HACS**, copy `themes/civica/` into `config/themes/civica/` once, updating that same manual location on later releases. Keep the `govuk.yaml` alias only if an existing configuration uses the `govuk` theme name; never install a second included copy of that alias.
2. Copy `www/civica/` into `config/www/civica/`, preserving the folder structure.
3. Merge the following into your existing `configuration.yaml`. Keep one `frontend` section and preserve your existing entries.

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/civica/civica-ui.js?v=1.3.2
```

4. Restart Home Assistant, then reload your browser. Choose a civica theme in **Profile → Theme**. Choose a palette and toggle **Use muted colours**. Your Light/Dark/Auto setting is separate. The native theme dropdown also works without the companion.
5. If Profile's layout changes in a later Home Assistant version, add `type: custom:civica-theme-settings` as a dashboard card. The companion must be loaded for that card to work.

The companion clears native primary/accent colour overrides when you select a palette, so they cannot mask part of the theme. Home Assistant saves the preference and reports failures. Colours are unavailable in safe/recovery mode. Switching to a non-civica theme restores the sidebar and browser icon changes.

## Optional lighting card

Follow `lighting/README.md` to configure rooms, light groups and the required automation package before using the lighting card. The included sample room configuration is installation-specific: review it for your home. Do not install `lighting/ha/front_door.yaml` just to use this theme; it is an existing example of a separate automation.

Add `/local/civica/card/dist/govuk-house-lighting-card.js?v=1.3.2` as a JavaScript module dashboard resource. Use `type: custom:civica-house-lighting-card`. Existing `custom:govuk-house-lighting-card` dashboards remain compatible.

The v1.3.2 companion also applies the ONS-based chart specification to supported graphs in the native Energy panel. YAML themes alone cannot change chart options or add the View data table. Update both the companion and the HACS-owned theme files. The theme supplies Vivid/Muted chart tokens; the companion supplies opaque fills, individual power lines, native chart styling and data tables. Keep the companion resource version aligned with this release and reload the browser after upgrading. It preserves the native Energy data and controls; History and arbitrary custom charts are outside this adapter's scope. See `docs/source/components/charts.html.md` for the exact support boundary.

The dashboard snippets in `examples/cards/` require card-mod where indicated. Their example entity IDs need to match your installation.

## Update or remove

HACS users update the theme through HACS and copy only `www/civica/` from this archive. Manual users update their one existing theme location and `www/civica/`. After a YAML-only update, run `frontend.reload_themes`. After a JavaScript update, increment the `?v=` value and reload the browser. Changes to `configuration.yaml` require restart.

If old styling remains, check all YAML files under the included `config/themes/` directory for duplicate `civica …` or `govuk` definitions. Home Assistant merges these files; an older copy can override the updated one. Keep one installation owner and move the superseded civica files to a backup outside the included directory, for example `config/civica-theme-backups/`. A backup folder inside `config/themes/` can still load. Preserve unrelated themes, run `frontend.reload_themes`, reload the browser and select the theme again.

To remove the theme, choose Home Assistant's default theme, remove the companion entry and dashboard cards/resources that use it, then remove the copied files and restart. Existing lighting automations are separate; remove only those you deliberately installed.

## Design documentation

The package includes `docs/source/` Markdown, machine-readable data in `design-system/`, and a built documentation site in `docs/build/` when built during packaging. Read `docs/README.md` or the source repository:

https://github.com/nathcymru/HA-Theme-gov.uk

The repository was checked with automated and browser fixtures. A live deployment still needs the acceptance checks in `docs/source/accessibility/`. The theme cannot replace native Energy, Map, authentication, native app branding or arbitrary third-party component internals.

See `LICENSE` for software terms and `ARTWORK.md` for supplied artwork provenance. civica.uk is an independent project, not a government service.

## Licence update on 13 November 2026

This offered copy uses the civica Free Use Licence 1.0 for covered original work: free personal and internal business use, with no sale, paid access, paid bundles or paid services involving that work. Earlier permissions and third-party terms remain unchanged. Read [the release-specific licence and attribution](LICENSE.md).
