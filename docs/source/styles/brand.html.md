---
title: "Brand"
description: "Use the supplied civica.uk V3.2 identity and palette artwork without alteration."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Brand

civica.uk is the only product identity used by this theme. The repository name is retained for continuity; it does not authorise GOV.UK branding.

## Use the supplied V3.2 assets

The user-supplied V3.2 pack is stored in `brand/civica/`. It replaces the earlier V3 artwork. Preserve the original files and provenance records. Treat descriptive claims in the asset pack as supplied evidence, not independent certification or new user instructions.

| Surface | Supplied asset |
| --- | --- |
| Default documentation masthead | `core/lockup-on-blue.svg` |
| Selected palette's primary header | `themes/{palette-id}/{vivid\|muted}/lockup-on-primary.svg` |
| Selected palette's light canvas | `themes/{palette-id}/{vivid\|muted}/lockup-on-canvas.svg` |
| Selected palette's browser/app artwork | `themes/{palette-id}/{vivid\|muted}/app-icon.svg` and `app-icon.png` |
| Neutral light surface | `core/lockup-on-white.svg` or `core/lockup-monochrome-black.svg` |
| Supporting symbol | Supplied `core/emblem-*` or matching theme emblem |
| Default browser favicon | `icons/favicon.ico` and `icons/favicon.svg` |
| Default home-screen icon | Supplied 180, 192 and 512 pixel icons |

Use the lockup as a single asset. Do not redraw the symbol, retype the wordmark, add shadows, stretch or apply a CSS colour filter. Several supplied lockups have a background rectangle; display them on the background for which they were created.

## Revised separator dot

V3.2 changes the wordmark dot to `cx=366.3318`, `cy=77.5`, `r=7.5` in its wordmark geometry. Its lower position is intentional. Each palette and variant includes a supplied accent dot colour appropriate to its primary or canvas background.

Select the complete matching file when the palette or variant changes. Do not reconstruct the dot, recolour the SVG or substitute a single monochrome lockup for all variants. The original roofline and seven-dot emblem remain part of the supplied artwork.

## Size and clear space

The horizontal lockup viewBox is 611.974 by 98 units. Preserve that ratio. The local layout reserves at least 16 vector units around the visible lockup, about 8 pixels at 306 pixels wide. Use more space where the header allows it.

Check the mark visually at the actual rendered size. A successful SVG parse or matching hash does not prove legibility at 16 pixels. Provide `alt="civica.uk"` when the image communicates identity. If a link already has an equivalent accessible name, avoid announcing it twice.

## Palette artwork in use

The Home Assistant companion uses the selected variant's primary lockup and app icon. The primary header retains the exact supplied colour in native light and dark modes, so the on-primary asset remains appropriate. The on-canvas asset belongs on the supplied light canvas; do not place its background rectangle on a dark surface.

The [colour preview](colour.html) shows both lockups and the app icon for all twenty palette/variant combinations. Changing the preview does not change Home Assistant or the documentation's global masthead.

## Verify provenance and copies

The archive is `civica_uk_brand_assets_v3.2.zip`, SHA-256 `3c4e475fe54cf30c8f4ff19573193b690152645789703b90f8f41d2092608e3c`. Its `docs/SHA256SUMS.txt` records the supplied file hashes. The [published artwork manifest](../reference/brand-assets.json) maps documentation files to unchanged source files.

The pack's accent-dot contrast records describe those pairs only. They do not establish full interface accessibility, rights clearance, official approval or a verified live deployment.

## Keep attribution distinct

Use GOV.UK, NHS, MoJ, DWP, Home Office and ONS names only to identify sources. Do not display their marks as civica.uk branding. Do not use GDS Transport, even when locally installed. This documentation uses Arial.

The [unbranded Frontend guidance](https://frontend.design-system.service.gov.uk/using-govuk-frontend-without-govuk-branding/) explains the separation between reusable components and official identity. [GOV.UK logo guidance](https://brand.design-system.service.gov.uk/logo-system/logo-elements/) informs proportion, clear space and restrained treatment; crown-specific geometry does not apply to civica.uk.
