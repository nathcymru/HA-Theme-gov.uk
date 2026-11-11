# Artwork and brand identity

`brand/civica/` contains the user-supplied **civica_uk_brand_assets_v3 (1).zip**, received on 11 November 2026. Files are copied without alteration. Run `npm run check:brand` to compare them with the pack's SHA-256 manifest. The pack's compliance statements are supplied reference material, not independent certification of this implementation.

The civica.uk emblem, outlined wordmark, lock-ups and icons replace GOV.UK identity in the documentation and optional Home Assistant companion. Geometry, aspect ratio and dot placement remain unchanged. A monochrome white lock-up is used on the ten dark primary headers; no colour filter or palette recolouring is applied. Clear space is supplied by the layout.

The archive does not grant a separate redistribution licence for its artwork. The repository's MIT licence applies to original software and documentation, not automatically to these supplied marks or third-party artwork. Inclusion here follows the owner's request to use the supplied identity in this project; downstream users must establish permission for reuse of the artwork.

No GOV.UK crown, official wordmark, crest or GDS Transport font is shipped in the deployable theme, companion or generated documentation. Links and factual attributions to GOV.UK and other official design systems remain. civica.uk is independent of government and Home Assistant. This repository name and legacy `govuk` code identifiers remain for installation compatibility; they are not a public-facing brand.

Existing scene symbols and the house floor plan in `card/assets/` predate this revision. They are retained for compatibility; their presence is not a new rights verification. The small cog path follows the existing Material Design icon convention. Do not infer a blanket artwork licence from the software licence.

The companion changes the authenticated sidebar label and browser icons only while a civica theme is selected. Home Assistant's login, startup, native app icon and installed PWA manifest are owned by Home Assistant and are not replaced by this theme. The native Energy and Map interfaces retain their names and functions.
