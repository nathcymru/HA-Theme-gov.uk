# Dependency licences and notices

The [machine-readable inventory](dependencies.json) records the exact locked Node.js and Ruby dependencies reviewed on 13 November 2026. It distinguishes shipped documentation code from build and test tools. It also records five JavaScript packages included inside the installed GOV.UK Tech Docs gem.

This inventory is evidence about the reviewed files. It does not grant rights to supplied artwork, government marks, external map data or services. Read the project's [licence and attribution page](https://nathcymru.github.io/civica/community/licensing.html) and [artwork record](https://github.com/nathcymru/civica/blob/main/ARTWORK.md) for those boundaries.

## Current project terms and previous permissions

The inventory uses `LicenseRef-civica-Free-Use-1.0` for original civica work supplied under the current project licence. This is a local identifier for custom terms, not an SPDX-listed or OSI-approved licence. It does not describe every item in this mixed distribution. The complete terms permit personal and internal business use while prohibiting sale and paid services involving the covered work.

The [historical project notice](history/LICENSE-v1.4.1.txt) is an exact copy from commit `d6dd7c869fd419baa8ee29a572b4b69ddd639f14`, published as v1.4.1. The inventory pins its bytes and immutable commit separately from the current licence. It preserves the previous MIT permission, including for existing original documentation artwork. Its original introductory attribution is historical evidence; use the current source notices for the reviewed third-party terms.

The current terms expressly preserve earlier permissions. Replacing a current download or changing a release description does not amend those retained grants. Third-party packages and separately licensed artwork continue to use their own terms. Read the complete project licence for its scope rather than treating the identifier as a blanket restriction on all files.

## Code distributed to browsers

The Home Assistant card and companion bundle original local code. Their checked build inputs do not include another npm chart renderer, map renderer or icon package. They call native Home Assistant interfaces, which keep their own licences.

The standalone documentation chart examples include Apache ECharts 6.1.0 (Apache-2.0), zrender 6.1.0 (BSD-3-Clause) and tslib 2.3.0 (0BSD). The map examples include MapLibre GL JS 6.16.0 (BSD-3-Clause, with additional bundled notices) and VersaTiles Style 7.0.1 (MIT). The `notices/npm/` directories preserve complete licence, copyright and NOTICE files for their installed dependency graph, including the supporting MIT, ISC, BSD and dual-licensed code. Type declarations may be in that graph without being copied into the browser bundle.

GOV.UK Frontend 6.6.0 supplies component JavaScript and CSS. Its [MIT notice](upstream/govuk-frontend-6.6.0-LICENSE.txt) is preserved from the pinned upstream source because the copy inside the Tech Docs gem omits the standalone licence file. The [Tech Docs gem notice](notices/gems/govuk_tech_docs-6.6.0/LICENCE) and [Rouge notice](notices/gems/rouge-4.7.0/LICENSE) cover reused documentation styling and syntax-highlighting material. These notices do not authorise GOV.UK identity assets or GDS Transport fonts.

MapLibre ships prebuilt JavaScript containing supporting code. The build-input trace therefore cannot identify every source module inside that prebuilt file. Keep MapLibre's complete notice and the supporting dependency notices together. The inventory does not claim that the separately resolved transitive package versions identify every internal module used to compile MapLibre's prebuilt release.

## Home Assistant labels and the cog icon

Selected native English labels in the terminology register are extracted from pinned Home Assistant Core and Frontend sources. Their Apache-2.0 licences are preserved under [reference/home-assistant-core](notices/reference/home-assistant-core/LICENSE.txt) and [reference/home-assistant-frontend](notices/reference/home-assistant-frontend/LICENSE.txt). The register records its extraction changes and source versions. The official website glossary has separate CC-BY-NC-SA-4.0 terms: local explanations are original; upstream definitions and artwork are not bundled.

The lighting card's cog path is an adapted historical variant of the Google-authored `cog-outline` icon identified by the Material Design Icons metadata. It is not byte-identical to the current upstream path. Preserve the [Material Design Icons licence](notices/reference/material-design-icons/LICENSE.txt) and [Google Material Design icons Apache licence](notices/reference/google-material-design-icons/LICENSE.txt). Other native `mdi:` icons are provided by Home Assistant. The collection's own notice distinguishes icons, fonts and code and preserves any separately licensed material; it is not a blanket licence for unrelated logos.

## Build and test tools

All 83 npm lock entries and 85 resolved gem versions are recorded, including optional platform variants. Bundler is recorded separately. Test-only axe-core uses MPL-2.0; it is not shipped as documentation or theme code. Ruby tool metadata includes MIT, BSD, Apache-2.0, Ruby and Ruby/GPL alternatives. The actual notice controls where metadata lists multiple terms.

Build/test notice filenames and hashes are recorded where available. Their binaries and complete tool distributions are not included in the installed Home Assistant modules. Some published build-tool packages omit standalone notices. The inventory identifies that limit instead of generating replacement copyright statements. Platform-specific packages absent from the review machine have lock metadata only; their binaries were not independently reviewed.

## Refresh and check

After `npm ci` and installation of the locked Ruby bundle, run:

```sh
node scripts/audit-licences.mjs --write
node scripts/audit-licences.mjs --check
```

The refresh reads installed package metadata and copies notice files verbatim. It does not contact package registries or edit the dependency locks. A refresh on a different platform can change the recorded installed-platform evidence; review that diff. Pinned primary-source notices and their hashes are in [upstream/sources.json](upstream/sources.json).

The check compares both dependency locks, requires one record per resolved package, verifies retained notice hashes and traces the five browser bundles without writing build output. It also checks the current project licence, its verbatim inclusion in `LICENSE.md`, matching package metadata and the preserved historical notice. It does not treat a successful check as legal clearance. When adding a new distributed library, inspect its actual notice and prebundled code as well as the package metadata.

The `licences/` directory must accompany the release archive and be published with the documentation. Keep visible OpenStreetMap attribution on activated maps; a local notice file does not replace it. The tile service's usage and privacy policies remain separate from its data licence.
