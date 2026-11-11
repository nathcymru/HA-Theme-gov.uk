---
title: "Settings and preferences"
description: "Settings and preferences for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Settings and preferences

Appearance is a reversible personal preference. Keep it close to Home Assistant's existing profile settings and use the native preference mechanism.

## Palette flow

1. The user chooses a palette or selects a civica theme through the native selector.
2. The palette select shows the theme's current palette.
3. The Use muted colours control shows its current variant.
4. Changing either control selects the matching generated theme.
5. A short status message confirms the applied choice.

Keep focus in the control. Do not navigate away, reload the page or ask for confirmation for an appearance choice. Do not modify other users' settings or call the backend-wide default-theme action for a personal preference.

## Preserve native controls

The native theme selector and light/dark/automatic setting remain available. The civica palette setting maps to a theme name, so it must stay in sync when the user uses the native selector.

Clear conflicting custom primary/accent overrides when applying a named palette. Explain this behaviour in the settings help text or documentation.

## Failure behaviour

If a theme is missing, keep the current selection and explain which theme needs installing. If the profile component changes, fail safely and offer the standalone settings card. Never hide native settings because the adapter did not find its expected target.

## Scope

The documentation's palette preview changes only its example. The Home Assistant module changes only the user's chosen theme through the native flow. Neither should be confused with configuring device lighting colours.

Read [Change theme colours](../get-started/colour-settings.html) for installation and fallback details.
