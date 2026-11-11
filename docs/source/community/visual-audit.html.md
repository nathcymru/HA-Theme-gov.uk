---
title: "Visual review: borders, icons and badges"
description: "Evidence and corrective rules from the November 2026 civica.uk visual review."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Visual review: borders, icons and badges

The visual review found poor icon hierarchy, harsh card outlines and dividers, and an angular notification count. This review compares the public GOV.UK homepage, official component sources and repository revision `95b7a58`. It separates source findings from live Home Assistant observations. A passing contrast test had not established a coherent visual hierarchy.

## Findings and corrective rules

| Finding | Evidence at the reviewed revision | Correction |
| --- | --- | --- |
| Structural edges were too prominent | `scripts/generate-themes.mjs` assigned `#6F777B` to light card borders and dividers; the current GOV.UK structural role is `#CECECE` | Split structural and essential-control roles; use quiet 1px container edges and stronger input boundaries |
| Global geometry affected unrelated components | The generator zeroed generic `ha-border-radius-sm` through `ha-border-radius-6xl` | Limit square corners to named cards, buttons, fields and dialogs; preserve shape-sensitive controls |
| Notification guidance lacked an explicit component | The status page only required an accessible count; it did not specify the MOJ pattern | Adopt the rounded red MOJ badge, its count rules and a documented native-drawer adaptation |
| Card details accumulated heavy boundaries | Repeated scene controls used ink outlines; some modal/detail boundaries were visually stronger than their content required | Review action hierarchy, simplify structural edges and retain visible affordance/focus on controls |
| Icon rules were too broad to guide replacement | The images page preferred native icons but had no provenance or component-scope rule | Inventory the actual shell symbols and keep HA domain icons; use official symbols only for their documented component purpose |
| Overview navigation used inconsistent symbols | Six internal destinations used a diagonal Unicode arrow, including same-page pop-ups | Use labelled SVG action links with a consistent round arrow marker and preserve every destination |
| Existing project cards retained a competing style | Appliance and collection cards used tiny labels and nested rounded outlines; the gas record resembled a black/yellow warning banner | Apply documented, reversible styles to those three known cards; retain all live state and controls |
| Overview had a competing scenic canvas | Sky Canvas rendered the house photograph behind ordinary dashboard controls | Select a plain canvas through the integration’s dashboard setting; retain the artwork and weather-card functionality |
| Documentation demonstrated older border colours | Its structural CSS used `#B1B4B6`, and the palette demo used an ink container edge | Use the same quiet structural role in the documentation while keeping input boundaries strong |

The Overview findings were reproduced in Chrome on Home Assistant 2026.11.0. Source inspection explains the causes; every deployed correction still needs the live checks below. This review does not establish coverage of arbitrary third-party cards.

## What the official references establish

The [GOV.UK colour roles](https://design-system.service.gov.uk/styles/colour/) distinguish structural borders from input boundaries. The [summary-list source](https://github.com/alphagov/govuk-frontend/blob/3862ef30df6a5da3e03974214cd28ffbfa769867/packages/govuk-frontend/src/govuk/components/summary-list/_mixin.scss) uses a 1px structural row divider. Neither justifies making every container look like an editable field.

The [GOV.UK homepage](https://www.gov.uk/) and its [publishing component guide](https://components.publishing.service.gov.uk/component-guide/action_link) show purpose-specific search and navigation symbols. They do not define household device icons. The [Design System image guidance](https://design-system.service.gov.uk/styles/images/) supports labelled icons in familiar, frequently used systems. Native HA domain symbols remain a controlled choice for that purpose.

The [MOJ notification badge](../components/notification-badge.html) supplies the missing count pattern. Its rounded red treatment is compatible with an otherwise square-edged interface. Its source implementation and the local accessibility adaptation must be reviewed separately.

## Close the review with evidence

Compare fresh desktop and narrow-screen Overview loads before and after the change. Include the sidebar, an unopened notification drawer control, nested card sections, a native form, a device dialog, Energy and Map. Inspect actual icons at their rendered size and verify that labels and state remain meaningful.

Exercise the badge with empty, single-digit, multi-digit and capped counts in a fixture. Verify actual available notification and update states in Home Assistant without creating or dismissing household notifications just to populate a screenshot. Record unavailable states as not tested.

Check light/dark modes, a muted palette, keyboard focus, forced colours and 200% text scaling. Switching away must restore native styling. Confirm that no global radius override or high-contrast divider has reappeared through a legacy variable.

The [source snapshot register](../reference/visual-audit-sources.json) records the exact code references inspected. Release results belong in the repository's verification record; this audit is not a claim of full conformance or a substitute for live review.
