---
title: "Typography"
description: "Typography for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Typography

Use Arial, Helvetica and the system sans-serif fallback consistently. Do not name GDS Transport anywhere in the active font stack. The supplied outlined civica.uk wordmark is artwork, not a font for interface text.

## Type hierarchy

| Role | Desktop starting point | Narrow-screen starting point |
| --- | --- | --- |
| Page heading | 48px, bold, 1.1 line height | 36px, bold |
| Section heading | 30px, bold, 1.2 line height | 24px, bold |
| Card heading | 24px, bold, 1.25 line height | 20px to 24px |
| Body and main controls | 19px, regular, 1.5 line height | 18px to 19px |
| Supporting metadata | 16px, regular, 1.5 line height | 16px |
| Primary sensor value | 32px to 48px, tabular numerals where useful | Fit the value and unit without truncation |

These are local starting points informed by the [GOV.UK type scale](https://design-system.service.gov.uk/styles/type-scale/). Maintained custom civica.uk UI uses 19px body/main controls and 16px metadata. Native HA dense controls/body use 16px, supporting labels 14px and compact ancillary text 12px. Existing larger native headings retain HA values, with card titles explicitly 24px. This is a controlled density adaptation to preserve native geometry; check it in live Home Assistant at 200% text size. The shared custom base sizes are `civica-font-size-body: 19px`, `civica-font-size-small: 16px` and `civica-font-size-heading: 24px`; native `ha-font-size-xs/s/m/l` base sizes are 12/14/16/19px. The generated values use `calc()` with `--ha-font-size-scale` so Home Assistant’s user text scaling remains effective.

Native dashboard section titles in `hui-heading-card` share the 24px bold card-heading size so an H2 does not appear weaker than the cards it introduces. The theme sets `ha-heading-card-title-font-size` to `var(--civica-font-size-heading)`, `ha-heading-card-title-font-weight` to `700`, and `ha-heading-card-title-line-height` to `1.25`. This compact dashboard adaptation preserves Home Assistant’s text scale and the existing heading semantics. Subtitle and caption tokens retain their native supporting hierarchy.

## Make hierarchy semantic

Use one meaningful page heading and ordered heading levels. A large sensor number is a value, not automatically a heading. Do not style a paragraph to look like a heading while leaving its semantics unchanged.

Use sentence case. Use bold for labels and selective emphasis, not whole paragraphs. Avoid uppercase action labels, italics for essential instructions and light grey text that reduces contrast.

## Keep text readable

Keep instructions near their controls. Let labels wrap. Reserve ellipsis for non-essential overflow where the full value can be obtained without pointer hover. A unit, warning or room name needed to identify a device must remain available.

Allow browser text resizing and user font preferences. Do not disable zoom or depend on fixed pixel container heights.

GOV.UK's [typeface guidance](https://design-system.service.gov.uk/styles/typeface/) requires an alternative to its font outside the relevant official service context.
