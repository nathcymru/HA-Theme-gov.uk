---
title: "Accessibility"
description: "Accessibility for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Accessibility

civica.uk targets WCAG 2.2 Level AA for the components it maintains. This is a design and testing target, not a claim that every Home Assistant component or installed custom card is conformant.

## Core requirements

- All controls have meaningful accessible names and keyboard operation.
- Text and controls remain usable at narrow widths and high zoom.
- Focus is visible, ordered and not hidden behind overlays.
- Meaning is available without relying on colour, shape or position alone.
- Normal text meets 4.5:1 contrast; large text and essential non-text boundaries meet their applicable 3:1 requirement.
- Errors identify the problem in text and provide a useful recovery route.
- Animation respects reduced motion; forced-colour modes retain visible controls.
- Live state updates avoid unnecessary announcements.

## Contrast has context

Test foreground/background pairs in the actual component state. A palette primary can pass against white while failing against a tinted surface. Opacity, overlays, disabled styles and embedded image colours can change the result.

A decorative card border has a different role from an input boundary. Keep that distinction in the token inventory and tests.

## Manual testing remains necessary

Automated checks cannot prove sensible focus order, useful labels, screen-reader announcements, pointer target usability or understandable content. Perform the [manual and browser checks](testing.html) and record results against a named release.

## Report an accessibility problem

Use the repository issue tracker with the page, component, browser, assistive technology if relevant, expected behaviour and actual behaviour. Include a minimal reproduction. Do not include private tokens or access credentials.

Guidance comes from the [GOV.UK accessibility approach](https://design-system.service.gov.uk/accessibility/) and the [Home Office Accessibility Standard](https://design.homeoffice.gov.uk/accessibility/standard), which aligns with WCAG 2.2 AA.
