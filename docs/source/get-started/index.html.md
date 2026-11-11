---
title: "Get started"
description: "Get started for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Get started

civica.uk has three layers. Install the layers your interface needs and keep their versions together.

| Layer | What it provides | What it cannot do alone |
| --- | --- | --- |
| Theme YAML | Shared colour, type, spacing and component variables across Home Assistant | Rewrite native page content or reach every private component style |
| Optional civica.uk interface module | Palette settings, controlled component styling and civica.uk browser identity while this theme is active | Change authentication pages, native app splash screens or every third-party card |
| Dashboard components and examples | Reusable arrangements for devices, room navigation and status | Replace Home Assistant's data model or backend permissions |

## Use the documented system

1. [Install the theme](install.html).
2. [Choose a palette and variant](colour-settings.html).
3. Review [compatibility](compatibility.html) for native and third-party components.
4. Use [components](../components/index.html) and [patterns](../patterns/index.html) for new work.
5. Run the [release checks](../accessibility/testing.html) before deploying a change.

## Design principles

- Show useful information before decorative content.
- Preserve Home Assistant's native navigation, keyboard behaviour and permissions.
- Make states and actions understandable without colour alone.
- Use one set of semantic tokens across all maintained components.
- Keep essential controls available at narrow widths and high zoom.
- Document deliberate deviations and the user need they serve.

These principles adapt the [GOV.UK Design System](https://design-system.service.gov.uk/) to repeated home use. More icons, continuous controls and live data are justified when they make household tasks clearer.
