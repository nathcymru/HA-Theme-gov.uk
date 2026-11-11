# CIVICA.UK — Brand asset verification, V3 (11 November 2026)

## Source hierarchy

**User artwork is authoritative.** `source/CiviCA LOGO - user supplied unmodified.svg` is included in the pack unchanged. The roofline (including its slight right-hand rise) and the circular seven-node arch are retained. The flat-colour production variants change only palette and scale, not shape. No oak wreath, inner hub, tree, or further Home Assistant logo component is added.

**Wordmark dot is not redesigned.** The `CIVICA.UK` wordmark vector geometry from the immediately previous export is retained exactly, with no retypesetting or modification, and its `<circle>` is: `cx=366.3318`, `cy=47.5`, `r=8`. The wordmark dot stays circular and fixed in position and size, with GOV.UK's teal-on-blue and blue-on-light colour rules. The wordmark source SVGs are copied byte-for-byte. The emblem's seven dots are **not** replacements for the wordmark separator.

## Reproducible measurements

- Source node radius: `22.5` units.
- Icon scale factor: `4 / 22.5 = 0.177777778`.
- Scaled emblem dot diameter: `8` units.
- Existing wordmark separator dot diameter: `16` units.
- Dot size relationship: `16 / 8 = 2×`.
- Gap from emblem artwork bounds to wordmark artwork bounds: `24` units, or `3 × 8` node-dot widths.
- Minimum clear space proposed around lock-ups: one wordmark dot width (16 wordmark units). This is the minimum, not an embedded margin, and should be provided by the implementing page layout.
- Dimensions: horizontal lock-up `611.9736 × 98.0000` user units. SVG `viewBox` retained across colour variants.

## Tests performed

1. All exported SVGs were parsed by an XML parser successfully.
2. Every lock-up contains the exact prior wordmark vector group, with its unchanged separator dot circle.
3. All source-emblem path commands have been retained verbatim within each production lock-up.
4. Colour variants use official GOV.UK palette hex codes (`#1D70B8`, `#00FFE0`, `#0B0C0C`, `#FFFFFF`).
5. PNG and WebP export succeeded and the proof was rendered at 1600×1140.
6. 16, 32, and 48 px icon assets were generated and contain visible foreground/background pixels. **This is not a human visual-acuity test.** Small-size appearance must also be reviewed in-browser.
7. No additional decorative effects, shadows, gradients, oak leaves, antenna hubs, or supplemental dots have been created.

## Compliance qualifications

The GOV.UK Brand Guidelines describe official government logos and use of an official wordmark and crown. A CIVICA.UK identity can adopt the channel hierarchy, spacing principles, colours, and accessibility intentions but **cannot truthfully be certified as literally compliant with the GOV.UK logo standard**: this is a different wordmark and symbol, and we have not received government approval. GOV.UK brand guidance is not an authorisation to present a service as part of government.

The wordmark is the pre-existing outlined Inter-derived CIVICA wordmark and is **not GDS Transport**, so exact typography equivalence is not achieved. Exact sizing and drop-in compatibility with current GOV.UK HTML/CSS must be tested in the actual Home Assistant theme; different wordmark widths mean original hardcoded layout widths may not be sufficient.

The supplied roof-and-dots motif resembles connected-home visual language but is not an official Home Assistant logo. Home Assistant's original logo is protected by the Open Home Foundation's trademark rules. Avoid implying endorsement or official affiliation. (https://contributors.home-assistant.io/brand/name-and-logo/)

## Installation and variants

- `logo/lockup-on-blue.svg`: Primary blue website header.
- `logo/lockup-on-white.svg`: Light-background header.
- `logo/lockup-dark-transparent.svg`: Transparent header overlay on dark UI.
- `logo/lockup-light-transparent.svg`: Transparent header on light UI.
- `logo/wordmark-*`: Identical typography and separator dot to prior asset version.
- `logo/emblem-*`: Roof and seven circular nodes from the user's SVG.
- `icons/`: All exported icon sizes including favicon and app icon.
- `CIVICA-UK-proof-v3.svg` and `.pdf`: proof artwork.
- `docs/verification.json`: Machine-readable verification checks.

Full mechanical replacement of gov.uk branding in a Home Assistant theme requires applying these files in the theme repository and checking real breakpoints, contrast, favicon rendering, screen-reader labels, and pointer/click target areas. No Home Assistant UI integration was executed here.
