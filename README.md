# HA-Theme-gov.uk

An unofficial Home Assistant theme that adapts the [GOV.UK Design System](https://design-system.service.gov.uk/) palette, typography and focus states to a smart home dashboard. Square corners, no gradients, no shadows, yellow focus rings. Light and dark modes.

Not affiliated with or endorsed by the Government Digital Service or Home Assistant.

## What you get

- `themes/govuk.yaml`: one theme named `govuk` with `light` and `dark` modes.
- `cards/`: copy-and-paste card snippets (emergency banner, panel, inset text, button grid) and the helpers they use.
- `scripts/contrast.py`: checks every key colour pairing against WCAG.

## Installation with HACS

HACS supports themes as a repository category.

1. In Home Assistant, open **HACS**.
2. Open the three-dot menu, choose **Custom repositories**.
3. Enter `https://github.com/nathcymru/HA-Theme-gov.uk`, set the category to **Theme**, and select **Add**.
4. Find **GOV.UK Theme** in HACS and select **Download**.
5. Make sure `configuration.yaml` loads themes:

   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```

   HACS places themes in `config/themes/`. If you manage themes elsewhere, adjust the path.
6. Restart Home Assistant, or run **Developer tools > Actions > `frontend.reload_themes`**.
7. Open your **Profile** page, choose **GOV.UK** under Theme, and pick Light, Dark or Auto under Mode.

### Manual installation

Copy `themes/govuk.yaml` into `config/themes/` and follow steps 5 to 7.

## Optional: card-mod

Theme variables cover the Home Assistant interface. The snippets in `cards/` use [card-mod](https://github.com/thomasloven/lovelace-card-mod) (install from HACS under Dashboard) for the banner colours, panel and button styling. The theme works without it; the snippets do not.

## Emergency banner

Follows the levels in the [GOV.UK emergency publishing manual](https://docs.publishing.service.gov.uk/manual/emergency-publishing.html).

1. Add the helpers in `cards/helpers.yaml` to your configuration and reload.
2. Paste `cards/emergency-banner.yaml` into a dashboard card (**Edit > Add card > Manual**).
3. Set `input_select.govuk_banner_type`:

| Option | Banner |
| --- | --- |
| `none` | Hidden |
| `death_notable_person` | Black `#0b0c0c`, white bold text |
| `national_emergency` | Red `#d4351c`, white bold text (Level 1) |
| `local_emergency` | Green `#00703c`, white bold text (Level 2) |

Optional text comes from `input_text.govuk_banner_message`. Place the card at the top of each dashboard view; a stack or a sections-view full-width row works well. An automation or the helper's entity card can change the type.

## Accessibility

Run `python3 scripts/contrast.py` to see the ratios. Summary: body text is AAA in both modes; the white-on-green button is 6.21:1 (AA, not AAA) and white-on-red banner text is 4.86:1 (AA), because those are the official GOV.UK colours. Focus rings are `#ffdd00`.

## Notes and limits

- GDS Transport is not bundled (its licence restricts it to GOV.UK services). The font stack falls back to Arial. If you have the font installed locally, it is used.
- Home Assistant does not expose every control to theme variables. Some components (for example the `ha-switch` internals and ripple effects) may keep minor default styling; report these as issues.
- Variable names were checked against the Home Assistant frontend `dev` branch in October 2026. Home Assistant can rename variables between releases.

## Licence

See [LICENSE](LICENSE): MIT for original code, Open Government Licence v3.0 for GOV.UK-derived values.
