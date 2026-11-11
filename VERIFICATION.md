# Verification — 11 November 2026

## v1.3.3 documentation and lighting request remediation

The documentation now contains 196 guides and 405 complete examples, including 14 card variants and 30 dedicated Home Assistant specifications. The 16 confirmed findings, 4 recommendations and 14 canonical ownership decisions are implemented with retained history and stable URLs. Shared dividers, semantic colours, body sizing, original artwork and truthful state, action and date examples follow the local guidance.

The maintained lighting card retains unknown and unavailable members in summaries, prevents duplicate per-room requests, distinguishes acceptance from observed state and retires pending batches when disconnected or reconfigured. A retired request cannot dispatch later rooms or unlock a newer batch. No physical commands were issued by validation. The legacy element and bundle remain available. Chart source colours, types and 1.5px production line weights are unchanged; sample-date navigation now has valid month boundaries and explicit scope.

Build, type checking, 50 Node regressions, 601 HTML link checks, 88 Home Assistant templates and all 176 supplied artwork hashes pass. All 767 unique browser cases pass across the full run and corrective reruns, including 39 retained family routes, 30 specification mappings, 14 card specimens and 200% text reflow. The [machine-readable remediation record](docs/data/remediation-verification.json) separates local execution, browser observations and publication status. Native task usability, assistive-technology studies and live equipment outcomes remain separate acceptance work.

## v1.3.2 native redraw recovery

ECharts could leave secondary split-sign geometry on the Canvas after a native legend or theme redraw even when its current data array was empty. Power series now use the renderer's zero-duration update path to finish in-flight transitions immediately. This changes no readings or axes and restores the native animation options when the theme is removed.

The regression verifies actual primary Canvas coordinates against signed values, empty secondary geometry, exact trace counts after hide/show, Light/Dark and date changes, and stability after the native transition window. Dense 320px coverage again requires exactly four source traces. The shared line weight remains 1.5px. Build/typecheck, 50 Node checks, 52 browser checks and 37 documentation pages pass.

## v1.3.1 thinner chart lines

Dense live Power readings remained visually heavy at the v1.3.0 2px weight. Supported line series now use **1.5px** in normal, hover, selected and blurred states. Legend strokes and the examples' displayed weight read the same production constant. The ONS 3px reference remains explicitly separate in the specification. Colours, source readings and chart types are unchanged.

Build, strict type checking, 50 Node checks, 51 browser checks across the full and focused runs, and 37 documentation pages pass. Canvas checks cover dense 320px Power data and a supported solar forecast line, including hover in Light/Dark; the separate signed-projection and restoration regressions remain intact.

## v1.3.0 chart consistency correction

The v1.2.0 examples did not reproduce native Energy gradients, split-sign Power arrays and alpha-coloured comparisons. Empty-day live checks also missed these differences. The examples now start with native-shaped inputs and use the same adapter as Home Assistant: individual unfilled 2px Power lines, opaque consumption columns and horizontal device bars. Strictly recognised positive/negative Power pairs select existing signed samples for both plot and table; native source arrays remain unchanged.

Chart colours now come from one deterministic identity-based generator. Vivid/Muted follows the selected theme, Light/Dark adjusts surface contrast, and changing the brand palette does not change chart identity. There are 24 fallback tokens plus an uncapped generated range, with matching legend patterns, line dashes and explicit labels. Contrast against the canvas does not mean every pair of colours is distinguishable.

Build and strict type checking pass, with **50 Node checks**, **50 browser checks**, **37 documentation pages**, **88 Home Assistant templates** and all **176 supplied V3.2 artwork hashes** verified. Browser coverage includes native-shaped Canvas rendering, actual opaque pixels, normal/hover line weights, tooltip/legend identity, 24 devices and comparisons, unchanged native arrays/options/callbacks, signed/zero/missing readings, and date-update/restoration races. The fixture is a source-shape replica, not a full Home Assistant installation. Separate release notes record populated live acceptance on Core 2026.11.1 / frontend 20261028.5.

## v1.2.0 ONS-based Energy charts

The earlier chart page specified general principles and colour roles but did not implement ONS chart presentation in the native Energy panel. This release adds a scoped, reversible adapter for the supported ECharts bar/line hosts, a current-values data table and working examples built with the same adapter and ECharts 6.1.0. The compatibility baseline is Home Assistant frontend 20261028.5; the official source record pins ONS Design System 74.0.0.

Build and strict type checking pass, with **43 Node checks**, **41 browser checks** and **36 documentation pages** validated. Real-renderer tests cover native data/options/callback identity, source comparison dates, missing/zero/negative values, device labels, all 251 paginated sample rows, daylight-saving offsets, legend and zoom preservation, renderer replacement, light/dark 320px accessibility checks and removal of owned styling. All 176 supplied V3.2 artwork hashes remain unchanged.

The standalone documentation bundle contains ECharts; the Home Assistant companion uses its existing native renderer. Synthetic examples are visibly labelled and do not establish live acceptance. Release notes record the installed-version checks separately. Native Energy distribution, History and arbitrary third-party charts are outside the adapter's stated scope.

## v1.1.1 live-review refinements

The live review exposed an older HACS palette file overriding a manually installed copy. Installation guidance now requires one theme owner and puts recovery copies outside the included themes directory. The running installation was reconciled to the HACS-managed path. Navigation circles now use the GOV.UK-like 20% brand tint and ink/white arrows; native section headings use the shared scaled 24px bold title tokens.

The final suite includes 43 Node checks and 30 browser checks, plus the 35-page documentation checks. Live acceptance details and the unchanged-device boundary are recorded in the release notes.

## v1.1.0 design correction

Developed from stable revision `95b7a58`. The correction separates quiet structural borders from input/control boundaries, restores a round MOJ notification count with live-count accessibility, adds labelled navigation links and aligns three known legacy cards with the shared typography and spacing. The [visual audit](docs/source/community/visual-audit.html.md) records the comparison and source evidence.

Build and strict type checking pass. All **42 Node checks** and **30 browser checks** pass. The Middleman site has **35 pages**, checked for links, fragments, automated accessibility and 320px reflow. All 176 supplied V3.2 asset hashes remain unchanged.

New browser coverage includes counts 0/1/98/99/100/1000, retained native count text nodes, live updates, expanded/collapsed accessible names, exact browser-rendered MOJ geometry at 100%/200% text size, dark-mode contrast, forced colours, cleanup/restoration, real link navigation/history and 320px legacy-card layouts. All 20 palettes are checked in both modes. These are reproducible fixture checks; live deployment results are recorded separately in the release notes.

## Previous v1.0.1 baseline

This change was developed from repository `main` at `8e765039bcec3fe98f48fa452e4a6fadb545bb54`. It was checked locally using Node 24.21.0, Google Chrome 157.0.8103.40, Ruby 3.3 and the pinned GOV.UK Tech Docs gem 6.6.0.

| Check | Result |
| --- | --- |
| Bundled lighting card and global companion | Build passed |
| TypeScript | Passed |
| Node regression and design-token tests | 39 passed |
| Browser integration and accessibility tests | 20 passed |
| Palette contrast | All 20 variants × Light/Dark modes passed the defined text, controls, focus and chart-surface checks |
| Documentation | Middleman build passed; 32 pages passed internal links/anchors, automated accessibility and 320px reflow checks |
| Documentation without JavaScript | Content and keyboard skip link passed |
| Generated palette documentation | Matches canonical JSON |
| Supplied brand assets | 176 V3.2 checksums verified unchanged; all 20 variant artwork pairs match canonical colours |
| Existing lighting package | 9 scripts, 6 restart-mode room wrappers and 88 templates checked |
| Installation archive | ZIP integrity check passed |

Browser tests cover custom-element registry replacement during startup, palette selection and mode preservation, all 20 supplied palette logos/icons in Light and Dark, native theme changes, default-theme entry, recovery mode, duplicate module loading, reversible branding, focus during hover, error navigation, unavailable devices, room-group membership, reserved-light exclusion and flashing-scene cancellation/failure. Native component adapters are tested with fixtures based on inspected Home Assistant source. They are not a running Home Assistant installation.

Desktop and mobile previews were visually inspected. An automated accessibility pass does not constitute full WCAG certification. Colour-pair checks do not establish that all adjacent chart series are distinguishable without labels or patterns.

## Live rollout and remaining acceptance

Chrome checks on Home Assistant 2026.11.0 verified all 20 palette/tone choices, independent Light/Dark mode, saved palette persistence after reload, restoration of default branding, the updated lighting card and its native room dialog, and navigation to native Energy and Map. Existing unavailable devices and missing Energy data remained visible. No physical device actions were sent.

The first live inspection found a sidebar icon contrast issue caused by native adopted stylesheets. A scoped native-token correction and a nested-component regression were added for the stable release. Release notes record final deployment acceptance.

Follow `docs/source/accessibility/testing.html.md` for further manual acceptance. Assistive-technology use, cross-device preference synchronisation, every native/third-party component, and physical-device execution have not been fully tested on this installation.

The Profile, sidebar, toolbar and more-info adapters depend on private component structure. They preserve native controls and fail without replacing core behaviour, but must be rechecked after Home Assistant upgrades. Authentication, installed PWA identity and native app branding are outside this module's coverage.
