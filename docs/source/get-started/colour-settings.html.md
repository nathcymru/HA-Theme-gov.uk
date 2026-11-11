---
title: "Change theme colours"
description: "Change theme colours for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Change theme colours

Open your Home Assistant profile and find the theme settings. Use the civica.uk colour controls to select a palette. You can also select a **civica** theme through the native dropdown.

## Choose a palette

Use **Colour palette** to choose one of the ten named palettes. Labels are always visible; colour swatches are supplementary. The order is stable and starts with Civic Cobalt.

## Change the colour strength

Use **Use muted colours** to switch between Vivid and Muted. A checked control selects Muted. An unchecked control selects Vivid. The palette stays the same.

The selected palette and variant also choose the matching supplied V3.2 header lockup and app icon. Their accent dots are part of the original artwork.

Both variants use the exact primary and canvas values in the [colour specification](../styles/colour.html). Vivid and Muted describe colour strength. They do not mean light and dark mode.

## How the setting is saved

The module asks Home Assistant to select the corresponding generated theme through its native theme-selection event. Home Assistant manages the profile preference. The module does not create a separate account or server-side preference store.

Choosing a palette clears custom primary/accent overrides so they cannot leave controls in the old colour. Home Assistant's light, dark or automatic mode preference is preserved independently. See [mode behaviour](../styles/colour.html) before choosing a dark mode.

## If the controls do not appear

Check that the module is loaded through `frontend.extra_module_url`, and that the browser is using the current module version. A non-civica theme shows a prompt to choose a palette. Reload after an upgrade.

The automatic profile placement uses Home Assistant's internal component structure. If that structure changes, use Home Assistant's native theme dropdown or the dashboard card:

```yaml
type: custom:civica-theme-settings
```

The native dropdown remains usable. Do not remove it to force people through the custom control.

## Safe and recovery mode

Colour controls are disabled in Home Assistant safe or recovery mode. The companion restores native branding and leaves recovery controls available.

## Interaction requirements

A palette change must not reload the page, move keyboard focus away from the control or change device state. Announce the chosen palette and variant with a polite status message. If any of the twenty generated themes are missing, the controls stay disabled and explain that the complete theme set must be installed. A missing theme must not silently choose a different palette.

The local toggle is inspired by GOV.UK's palette variants, but it is a civica.uk Home Assistant feature. GOV.UK's documented [colour variants](https://design-system.service.gov.uk/styles/colour/) are Sass palette options, not this user settings control.
