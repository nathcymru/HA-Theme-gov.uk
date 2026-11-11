---
title: "Navigation"
description: "Navigation for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Navigation

Keep Home Assistant's native sidebar, dashboard navigation and profile access. Users need a reliable route to the same functions before and after applying civica.uk.

## Main navigation

Use text labels with existing icons. Show the current destination with a persistent indicator and accessible current-state semantics. Do not rely only on a colour change.

Keep sidebar collapse behaviour, keyboard activation and narrow-screen navigation working. Do not turn links into buttons if they navigate, or buttons into links if they perform an action.

## Room and dashboard navigation

Use clear room names and consistent ordering. Keep a visible route back to the dashboard overview. Avoid stacking multiple navigation bars that repeat the same destinations.

Tabs are appropriate for related views within one context. Preserve native tab keyboard behaviour. A palette selector is a form control, not another navigation tab.

## Brand placement

The civica.uk mark occupies the theme's identity area, with enough space to remain legible. Do not cover a menu toggle or shrink the navigation targets to fit it. On a narrow screen, use the supplied compact emblem only where the adjacent text or accessible name still identifies the service.

## Native panels

Energy, History, Map, Settings and developer tools retain their native routes. Do not introduce duplicate “Energy” pages that appear authoritative while omitting native capabilities.

The layout draws from GOV.UK's [service navigation](https://design-system.service.gov.uk/components/service-navigation/) and MoJ's [side navigation](https://design-patterns.service.justice.gov.uk/components/side-navigation/), adapted to Home Assistant's persistent shell.
