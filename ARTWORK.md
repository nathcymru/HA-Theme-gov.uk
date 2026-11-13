# Artwork and brand identity

`brand/civica/` contains the accepted files from the user-supplied **civica_brand_assets_revised.zip**, received and reviewed on 13 November 2026. It replaces the previous supplied identity completely. The project is named **civica**; the supplied wordmark reads **Civica**. The archive SHA-256 is `0d1a44c3526ccaafa773e1d7314d0d3df6e2e77065be7c3f9c2e1de36dc14d2a`.

The archive supplies no numeric version. The local provenance label is `revised-2026-11-13`. Its 225 file entries contain 219 images. We accept 224 supplied files unchanged, including 218 images, and add one local manifest. The active package therefore contains 225 files. Previous logos are removed from the working tree and release inputs; their earlier revisions remain in Git history.

## Accepted files and source defects

[`brand/civica/docs/accepted-assets.json`](brand/civica/docs/accepted-assets.json) is the authoritative accepted-file inventory. It records the actual SHA-256, byte length and decoded dimensions of each accepted image, the original archive identity and these source defects:

- `themes/civic-cobalt/muted/emblem-primary.webp` is empty and cannot decode. It is excluded, without regeneration. Its valid supplied SVG and PNG counterparts remain available. WebP coverage is partial: 18 valid WebP files are retained; missing variants are not invented.
- The supplied `docs/SHA256SUMS.json` contains a stale checksum for itself. All 224 other entries match their original archive bytes, including the omitted empty file. The source manifest is preserved unchanged; the accepted manifest records its actual hash and the discrepancy.
- The supplied `docs/verification.json` reports 197 theme files and 224 ZIP entries. The archive actually contains 167 theme files and 225 file entries. After the empty file is excluded, 166 theme files remain. These supplied metadata values are preserved as source evidence and corrected explicitly in the accepted manifest.

Every accepted image decoded successfully in Chromium 153.0.8010.12. Visual review covered the core PNGs, all 20 theme primary lockups, all 18 accepted WebPs and the supplied proof sheets. The valid WebPs show the revised identity. This checks file integrity and identity consistency, not accessibility or redistribution rights.

Run `npm run check:brand` to check accepted hashes, image signatures, the exact inventory, documented omissions and palette agreement. Run `python3 docs/scripts/sync-brand.py --check` to check the 67 published documentation copies and their source mapping in `docs/source/reference/brand-assets.json`. The accepted manifest deliberately does not hash itself; the documentation mapping records its hash.

## Revised identity and palette variants

The supplied emblem is a house outline with a chimney and six internal dots in two rows of three. It replaces the earlier roofline emblem, seven dots and wordmark separator dot. Preserve the new files' geometry, aspect ratio, colours, internal spacing and transparency. Do not reconstruct the previous logo through aliases, crop the supplied view box or apply CSS filters to recolour a mark.

Core lockup SVGs use a `1180 × 260` view box, including their supplied trailing space. Their wordmark is live SVG text using the supplied Arial, Helvetica, Liberation Sans, Arimo and sans-serif fallback stack; it is not outlined lettering and may render differently across systems. The package also supplies raster alternatives. Clear space around the asset comes from the interface layout.

Core marks are under `core/`; browser and home-screen icons are under `icons/`. `source/approved-concept-reference.png` and its copy in `proof/` are supplied concept references, not replacement production lockups. `proof/civica-revised-pack-proof.png` records the supplied production proof. Production consumers use the designated core or theme files.

All ten palette names and all 40 primary/canvas colour values in `docs/brand-tokens.json` match `design-system/palettes.json`. Each of the 20 palette/tone directories includes valid SVG and PNG versions of the primary lockup, canvas lockup, primary emblem and app icon. The Home Assistant companion selects `themes/{palette-id}/{vivid|muted}/lockup-on-primary.svg`, `app-icon.svg` and `app-icon.png`. The primary header retains the supplied palette colour in light and dark modes. The documentation masthead uses the core blue lockup; its palette preview uses the matching supplied theme assets.

Supplied colours and successful image decoding do not certify surrounding interface text, focus indicators, chart series, small-size legibility or the whole application. Those have separate implementation and acceptance checks.

## Rights and attribution

The archive does not include a separate redistribution licence for its artwork. The project software licence does not automatically apply to these supplied marks or third-party artwork. Inclusion follows the owner's request to use this identity in the project; downstream users must establish permission for reuse of the artwork.

No GOV.UK crown, official wordmark, crest or GDS Transport font is included in this supplied package or the deployable documentation identity. Links and factual attributions to official design systems remain. civica is independent of the UK Government and Home Assistant. The project repository is `nathcymru/civica`.

The five unused legacy scene SVGs under `card/assets/icons/` were removed on 13 November 2026. They included the Everton FC crest and the WRU mark; no redistribution grant was recorded for those files or the other three scene images. The lighting card already uses Home Assistant’s native scene icons and does not reference the removed files. They are excluded from current source and future release packages; Git history retains the historical files without granting new rights.

`card/assets/floorplan.png` is an existing supplied household image. It remains in use by the lighting card, but no separate redistribution licence or author permission record was supplied in this repository. Its hash establishes file identity, not ownership or permission. It is excluded from the project software licence; downstream users must establish permission or provide their own authorised floor plan. The same unresolved redistribution-grant boundary applies to the revised civica marks described above.

The card’s inline cog follows the Material Design icon source; native `mdi:` names refer to Home Assistant’s own icon system. Their licence and attribution treatment is separate from original project code. Do not infer a blanket artwork licence from the software licence.

## Original documentation illustrations


The homepage household scene and three category illustrations form a flat Civic Cobalt family. They were redrawn on 11 November 2026 using a restrained set of blue tones and white, without decorative outlines. They are existing original repository illustrations under MIT, separate from the supplied brand marks. Their previously granted terms remain unchanged; the notice is preserved in `licences/history/LICENSE-v1.4.1.txt`. Per-file purpose, colour, background, alternative-text decisions and hashes are recorded in `docs/data/illustration-assets.json`. They are conceptual illustrations, not screenshots or evidence of a device state. The card specimens have their own original-artwork record in `docs/data/card-artwork-provenance.json`.

## Surface coverage

civica is the project and documentation identity. Households may choose their own home, family or organisation identity through the documented personalisation boundaries.

The companion changes the authenticated sidebar label and browser icons only while a civica theme is selected. It restores native identity when the user switches away or enters safe/recovery mode. Home Assistant's login, startup, native app icon and installed PWA manifest are owned by Home Assistant and are not replaced by this theme. The native Energy and Map interfaces retain their names and functions.
