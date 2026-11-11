---
title: "Brand"
description: "Brand for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Brand

civica.uk is the only product identity used by this theme. The repository name is retained for continuity; it does not authorise GOV.UK branding.

## Use the supplied assets

The user-supplied V3 pack is stored in `brand/civica/`. Preserve its original files and provenance records. Treat descriptive claims in the asset pack as supplied evidence, not independent certification.

| Surface | Asset |
| --- | --- |
| Cobalt blue header | `logo/lockup-on-blue.svg` |
| Other dark palette header | `logo/lockup-mono-white.svg` |
| White header or page | `logo/lockup-on-white.svg` or `logo/lockup-mono-black.svg` |
| Supporting small symbol | Supplied emblem variant appropriate to the background |
| Browser favicon | `icons/favicon.ico` and `icons/app-icon.svg` |
| Home screen icon | Supplied 180, 192 and 512 pixel icons |

Use the lockup as a single asset. Keep its viewBox, wordmark geometry, roofline, seven-dot arc and circular separator unchanged. Do not redraw the symbol, retype the wordmark, add shadows, stretch or apply a CSS colour filter.

## Size and clear space

The pack's horizontal lockup viewBox is 611.9736 by 98 units. Preserve that ratio. Its proposed minimum clear space is 16 vector units, measured from the visible artwork. At 306 pixels wide, this is about 8 pixels. Use more space where the header allows it.

Check the mark visually at the actual rendered size. A successful SVG parse does not prove legibility at 16 pixels. Provide `alt="civica.uk"` when the image communicates identity. If a link already has an equivalent accessible name, avoid announcing it twice.

## Apply the brand across surfaces

Replace documentation header/footer identity, browser icons, mobile shortcut images, sharing images and theme-colour metadata wherever those surfaces belong to this project. Do not leave an upstream crown hidden in a default footer or favicon.

In Home Assistant, the optional module applies its identity only while a civica theme is active and restores native browser identity when the user switches away. Authentication pages and native companion app icons are outside this module's coverage.

## Keep attribution distinct

Use GOV.UK, NHS, MoJ, DWP, Home Office and ONS names only to identify sources. Do not display their marks as civica.uk branding. Do not use GDS Transport, even when locally installed. This documentation uses Arial.

The [unbranded Frontend guidance](https://frontend.design-system.service.gov.uk/using-govuk-frontend-without-govuk-branding/) explains the separation between reusable components and official identity. [GOV.UK logo guidance](https://brand.design-system.service.gov.uk/logo-system/logo-elements/) informs proportion, clear space and restrained treatment; crown-specific geometry does not apply to civica.uk.
