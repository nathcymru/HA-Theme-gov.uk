---
title: "Compatibility and limits"
description: "Compatibility and limits for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Compatibility and limits

A Home Assistant theme is a layer over a changing application. It cannot guarantee that every native or third-party component exposes all its styles.

## Coverage contract

| Area | Intended behaviour | Verification needed |
| --- | --- | --- |
| Native shell, sidebar and toolbars | Consistent theme variables and active-theme identity | Fresh load, narrow view, keyboard navigation |
| Standard cards and controls | Shared type, border, focus and semantic colours | Actual card types used by the household |
| Profile palette settings | Palette select and Muted toggle next to native settings | Home Assistant profile structure for each supported release |
| Native Energy and History | Preserve data, units, dates, navigation and series meaning | Fresh entry to native panels, tooltip and data access |
| Native Map | Preserve map attribution, controls, markers and navigation | Actual map provider and marker contrast |
| Custom cards | Use public variables where available | Each installed card's private styles and updates |
| Authentication and companion apps | Native branding and authentication remain outside module coverage | Separate native application work would be required |

## Private component adapters

The module targets four known component types: `ha-pick-theme-row`, `ha-sidebar`, `hass-subpage` and `ha-top-app-bar-fixed`. It places the colour settings, brands the sidebar and corrects toolbar icon/focus contrast through those open component roots. These adapters are version-sensitive. If an expected component is absent, the module should leave the native interface usable and offer the standalone settings card.

Safe and recovery modes disable colour controls and restore native branding. Repeated module imports must not add duplicate controls or listeners.

Avoid monkey-patching browser prototypes, replacing native controls wholesale or assuming a selector is a public Home Assistant API. Document each adapter and test its cleanup when the user switches away from civica.uk.

## CSS cannot correct everything

Styling does not fix an upstream missing label, an inaccessible chart tooltip, a closed component root, third-party hardcoded colours or the wording inside an integration's form. Track those as specific compatibility issues with reproduction steps. Do not call them compliant just because surrounding colours match.

## Verification status

Local build, contrast and component tests can be reproduced from the repository. A local preview is not proof of a live Home Assistant deployment. A release must record the Home Assistant version, browser, components tested and any remaining failures. Do not state that the user's live system has been updated without checking that deployment.

Follow the [testing checklist](../accessibility/testing.html) for native panels and cold loads.
