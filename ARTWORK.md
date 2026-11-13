# Artwork and brand identity

`brand/civica/` contains the user-supplied **civica_uk_brand_assets_v3.2.zip**, received on 11 November 2026. It replaces the earlier V3 pack. Files are copied without alteration. The archive SHA-256 is `3c4e475fe54cf30c8f4ff19573193b690152645789703b90f8f41d2092608e3c`.

The pack contains 177 files. Its `docs/SHA256SUMS.txt` records 176 entries, excluding the manifest itself. Run `npm run check:brand` to check the supplied files. Run `python3 docs/scripts/sync-brand.py --check` to check the published documentation copies and their source mapping. The pack's compliance and contrast statements are supplied reference material, not independent certification of this implementation.

## Revised identity and palette variants

V3.2 provides the revised wordmark separator dot at `cx=366.3318`, `cy=77.5`, `r=7.5` in the wordmark geometry, plus contrasting accent dots for every palette and Vivid/Muted variant. The source roofline and seven-dot emblem remain supplied artwork. Preserve the geometry, aspect ratio, dot position and colours of each file. Clear space comes from the interface layout.

The core assets are under `core/`; small browser and home-screen icons are under `icons/`. The original source is `source/CiviCA LOGO - original unmodified.svg`, and the visual proof is `proof/civica-uk-v3.2-proof.png`.

The Home Assistant companion selects `themes/{palette-id}/{vivid|muted}/lockup-on-primary.svg`, `app-icon.svg` and `app-icon.png` from the supplied pack. The primary header stays the supplied palette colour in light and dark modes. No CSS filter, SVG rewriting or blanket monochrome substitution is used. The documentation uses the core blue lockup for its masthead and shows the matching primary/canvas lockups and app icon in its palette preview.

The supplied contrast record concerns each asset's accent dot against its stated background. It does not certify surrounding interface text, focus indicators, chart series, small-size legibility or the whole application. Those require their own checks.

## Rights and attribution

The archive does not grant a separate redistribution licence for its artwork. The project software licence does not automatically apply to these supplied marks or third-party artwork. Inclusion here follows the owner's request to use the supplied identity in this project; downstream users must establish permission for reuse of the artwork.

No GOV.UK crown, official wordmark, crest or GDS Transport font is shipped in the deployable theme, companion or generated documentation. Links and factual attributions to GOV.UK and other official design systems remain. civica.uk is independent of government and Home Assistant. This repository name and legacy `govuk` code identifiers remain for installation compatibility; they are not a public-facing brand.

Existing scene symbols and the house floor plan in `card/assets/` predate this revision. They are retained for compatibility; their presence is not a new rights verification. The small cog path follows the existing Material Design icon convention. Do not infer a blanket artwork licence from the software licence.

## Original documentation illustrations

The homepage household scene and three category illustrations form a flat Civic Cobalt family. They were redrawn on 11 November 2026 using a restrained set of blue tones and white, without decorative outlines. They are original repository illustrations under MIT, separate from the supplied brand marks. Per-file purpose, colour, background, alternative-text decisions and hashes are recorded in `docs/data/illustration-assets.json`. They are conceptual illustrations, not screenshots or evidence of a device state. The card specimens have their own original-artwork record in `docs/data/card-artwork-provenance.json`.

## Surface coverage

The companion changes the authenticated sidebar label and browser icons only while a civica theme is selected. It restores native identity when the user switches away or enters safe/recovery mode. Home Assistant's login, startup, native app icon and installed PWA manifest are owned by Home Assistant and are not replaced by this theme. The native Energy and Map interfaces retain their names and functions.

## Licence update on 13 November 2026

Original documentation illustrations and specimens retain their previously recorded MIT permissions. The exact former project notice is preserved in `licences/history/LICENSE-original.txt`. The current root `LICENSE` sets the scoped civica Free Use Licence 1.0 terms; it does not revoke earlier grants or change any separately licensed artwork or third-party material.
