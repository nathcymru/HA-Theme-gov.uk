---
title: "Sources and provenance"
description: "Sources and provenance for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Sources and provenance

These official sources were reviewed on 11 November 2026. They inform the local system; their example markup and organisation-specific instructions are not automatically adopted.

| Source | Applied to civica.uk | Qualification |
| --- | --- | --- |
| [GOV.UK Design System](https://design-system.service.gov.uk/) | Overall styles, components and patterns | Adapted to Home Assistant tasks |
| [Writing standards](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/) | Clear, active, user-centred interface copy | Preserve user device names and native translations |
| [Brand guidelines](https://brand.design-system.service.gov.uk/) | Proportion, clear space, hierarchy and restrained presentation | Official marks replaced by civica.uk |
| [Frontend without GOV.UK branding](https://frontend.design-system.service.gov.uk/using-govuk-frontend-without-govuk-branding/) | Alternative font, header, icons and metadata | No claim of government affiliation |
| [GOV.UK website repository](https://github.com/alphagov/govuk-design-system) | Navigation and documentation organisation | Upstream is Node; this site uses Middleman |
| [Tech Docs Template](https://github.com/alphagov/tech-docs-template) | Actual documentation build and template foundations | Pinned gem, local unbranded layout |
| [MoJ design system](https://design-patterns.service.justice.gov.uk/) | Navigation and modal/card pattern references | Modal and card pages are experimental |
| [NHS design system](https://service-manual.nhs.uk/design-system) | Cards and useful imagery | No NHS branding imported |
| [DWP design system](https://design-system.dwp.gov.uk/) | Explicit current status and information hierarchy | No claim/case terminology imposed on households |
| [Home Office design system](https://design.homeoffice.gov.uk/design-system) | Internal-system adaptations, purposeful images and accessibility | No Home Office colour/font identity imported |
| [ONS design system](https://service-manual.ons.gov.uk/design-system) | Chart and data presentation references | Apply chart guidance alongside native HA capabilities |
| [ONS data visualisation](https://service-manual.ons.gov.uk/data-visualisation) | Titles, units, sources, series and accessible alternatives | Stable chart meanings across palette changes |
| [Home Assistant frontend](https://www.home-assistant.io/integrations/frontend/) | Theme loading and native frontend configuration | Private UI adapters require version-specific checks |

## Local sources

- `design-system/palettes.json`: canonical supplied palette specification.
- `design-system/themes.json`: resolved theme-variable mapping.
- `brand/civica/`: supplied V3 asset pack, proof and provenance records.
- `docs/source/design-contract.json`: machine-readable local rules.
- `docs/source/llms.txt`: reading order for agents and automated tooling.

## Verify claims at the right level

A source's accessibility findings apply to its tested implementation, not automatically to civica.uk. The supplied asset pack's verification record describes its mechanical checks; it does not establish live Home Assistant compatibility or government approval.

Record source changes during maintenance and update the [deviation register](deviations.html), implementation and tests together.
