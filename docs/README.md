# civica.uk documentation

This is a real [GOV.UK Tech Docs Template](https://github.com/alphagov/tech-docs-template) site, using Middleman and pinned `govuk_tech_docs` 6.6.0. It follows the GOV.UK Design System's Get started / Styles / Components / Patterns / Community / Accessibility organisation, with Writing guide added as a separate main section and an independent civica.uk identity.

The upstream GOV.UK Design System website uses Node. This project maps its information architecture and layout into Middleman's `source/`, `layouts/`, `data/` and `config/` structure. It does not claim that the upstream Node repository is a Middleman template.

## Build

Use Ruby 3.3, Bundler, Node and Python 3. On macOS, the system Ruby 2.6 is too old; use an installed Ruby 3.3 through your preferred version manager.

```sh
npm ci
npm run build
cd docs
bundle config set --local path vendor/bundle
bundle install
bundle exec middleman build
```

For a local preview, run `bundle exec middleman server`. Generated output is in `docs/build/` and is not committed.

Run the Node build from the repository root first: it builds the shared Energy chart adapter and the real-renderer examples used by the chart documentation. The example bundle includes ECharts for standalone demonstrations; the Home Assistant runtime uses the existing native renderer and does not load a second copy.

From the repository root, check internal links and regenerate/check the palette reference:

```sh
python3 scripts/check-docs.py
python3 docs/scripts/sync-palettes.py --check
python3 docs/scripts/sync-brand.py --check
```

After changing canonical `design-system/palettes.json`, run `python3 docs/scripts/sync-palettes.py` and commit its generated documentation and reference copies. Human rules start in `source/get-started/`; machine-readable guidance starts in `source/llms.txt` and `source/design-contract.json`.

The same build creates the documentation-only OpenStreetMap vector example with pinned MapLibre and VersaTiles dependencies. Tiles load only after the reader selects **Load OpenStreetMap**. The public provider configuration is `source/reference/map-example-provider.json`; retain visible attribution and observe the linked provider policy. No Home Assistant connection is used.

## Theme roadmap

The public `/community/roadmap.html` page covers **theme features only**, not documentation work. Its canonical public input is `data/roadmap.json`; `source/reference/roadmap.json.erb` publishes the same safe fields. The committed empty snapshot is an honest starting point for offline builds, not a list of invented features. Live builds fetch the reviewed issues before rendering.

Use the repository's **Theme roadmap item** issue form and follow [Maintain the theme roadmap](https://nathcymru.github.io/HA-Theme-gov.uk/community/maintain-roadmap.html). A maintainer reviews the household benefit, sets exactly one readable `tag: ` category, and applies `roadmap: in-works` to an open issue or `roadmap: completed` to a feature released to users and closed as completed. No publishing label is assigned by the form. `Developer Notes` is the final submitted textarea heading and a hard parser boundary. BSL/audio links are intentionally outside the current scope.

```sh
npm run roadmap:check
# Explicit network refresh; supply a token through your environment, not source.
GITHUB_REPOSITORY=nathcymru/HA-Theme-gov.uk npm run roadmap:fetch
# Or write a separate review snapshot:
GITHUB_REPOSITORY=nathcymru/HA-Theme-gov.uk node scripts/roadmap.mjs --fetch --output /tmp/civica-roadmap-preview.json
```

The fetcher reads `GITHUB_REPOSITORY` (set it explicitly to the repository being published) and `GH_TOKEN` or `GITHUB_TOKEN`. Use an issues-read token. The versioned label definitions are `.github/roadmap-labels.json`; these labels have been created in the upstream repository. A fork must create the labels in its own repository before maintainers use them. More readable `tag: ` categories may be added without changing code.

Both the Node build and direct Middleman build validate the snapshot offline. The validation workflow refreshes it only on trusted non-PR runs. Relevant issue changes, a main push, a manual run and a daily recovery schedule use the same mandatory tests and Pages deployment gate. Whole-workflow concurrency and latest-main checkout prevent an old queued event from restoring old source. Failed API requests or invalid items stop deployment and leave the existing site intact. No raw issue payload, credentials, issue references or developer notes are written to public data, and generated content is never auto-committed.

Run `node --test test/roadmap.test.mjs test/roadmap-workflow.test.mjs` and, after building the docs, `npm run test:browser -- tests/roadmap.browser.spec.mjs --workers=1`. Browser fixtures contain invented features and render the production partial; they are never shipped as roadmap entries. Human review still owns writing quality and release truth.

## Project identity

The template's renderer, syntax highlighting, contents helpers and selected component styles are used. The local shell replaces all official identity. It uses civica.uk identity for project documentation, keeps household personalisation separate, excludes upstream branded assets, and omits GDS Transport font-face rules. The built output must be checked after dependency upgrades.

`source/images/` contains byte-for-byte copies of the needed supplied V3.2 core, icon and palette assets from `brand/civica/`. Keep the originals and provenance there unchanged. Run `python3 docs/scripts/sync-brand.py` after an authorised asset-pack update; it also regenerates the published artwork manifest. This site does not claim official government affiliation or a completed accessibility certification.


## Author guidance and examples

Use `.html.md.erb` for Markdown pages containing the shared `example()` helper. Give new guidance a title, description, section/group, publication and update dates, and accurate update notes. Keep first-publication dates stable. The shell requires a history record on every non-home editorial page; standalone example canvases use their owning guide’s history.

Add examples to a `data/*examples.yml` catalogue with a unique ID, title, description and HTML. Middleman generates `/examples/<id>.html`, and the shared helper renders the same final markup in an iframe and the HTML tab. Standard components are enhanced with pinned GOV.UK Frontend 6.6.0. Ordinary demo forms use `data-demo-form` and a local status region; the build makes their controls inert until the local handler is ready. Publishing filters have a separate explicit local-data protocol. Never connect examples to a household.

The component and pattern catalogues, section navigation, sitemap and search are generated from the page metadata. The seven main navigation sections are defined in `data/navigation.yml`, including Writing guide. Its existing `/content/` routes are preserved; `/styles/content.html` remains a legacy entry point. The project story is under Get started at `/get-started/about.html`. Source-index inventories are published together in `reference/coverage.json`; keep their page and example mappings accurate.

Section headers are assigned in `data/page-illustrations.yml`. Use the original 640 by 480 SVGs without cropping in the right-hand half of the wide header panel. Keep the breadcrumb, title and summary as HTML on its left. The panel extends from the content edge to the viewport edge; mobile stacks text and art, and enlarged text increases its height. The Styles, Components and Patterns homepage cards share the same scene geometry as their section headers. Purpose, alt decisions, provenance and checks are recorded in `data/section-artwork-provenance.json`.

Run the documentation browser suite after building:

```sh
npm run test:browser -- --workers=4
```

It checks guide structure/history, source-to-preview parity, every standalone example’s accessibility/reflow, safe no-JavaScript forms and important interactions. The included Energy browser suite tests the shared production adapter. Do not describe those checks as proof that every reference pattern is installed in native Home Assistant.
