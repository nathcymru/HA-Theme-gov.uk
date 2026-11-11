# Verification — 11 November 2026

This change was developed from repository `main` at `8e765039bcec3fe98f48fa452e4a6fadb545bb54`. It was checked locally using Node 24.21.0, Google Chrome 157.0.8103.40, Ruby 3.3 and the pinned GOV.UK Tech Docs gem 6.6.0.

| Check | Result |
| --- | --- |
| Bundled lighting card and global companion | Build passed |
| TypeScript | Passed |
| Node regression and design-token tests | 39 passed |
| Browser integration and accessibility tests | 18 passed |
| Palette contrast | All 20 variants × Light/Dark modes passed the defined text, controls, focus and chart-surface checks |
| Documentation | Middleman build passed; 32 pages passed internal links/anchors, automated accessibility and 320px reflow checks |
| Documentation without JavaScript | Content and keyboard skip link passed |
| Generated palette documentation | Matches canonical JSON |
| Supplied brand assets | 176 V3.2 checksums verified unchanged; all 20 variant artwork pairs match canonical colours |
| Existing lighting package | 9 scripts, 6 restart-mode room wrappers and 88 templates checked |
| Installation archive | ZIP integrity check passed |

Browser tests cover palette selection and mode preservation, all 20 supplied palette logos/icons in Light and Dark, native theme changes, default-theme entry, recovery mode, duplicate module loading, reversible branding, focus during hover, error navigation, unavailable devices, room-group membership, reserved-light exclusion and flashing-scene cancellation/failure. Native component adapters are tested with fixtures based on inspected Home Assistant source. They are not a running Home Assistant installation.

Desktop and mobile previews were visually inspected. An automated accessibility pass does not constitute full WCAG certification. Colour-pair checks do not establish that all adjacent chart series are distinguishable without labels or patterns.

## Outstanding live acceptance

No live Home Assistant deployment or device action was performed in this task. Before deploying, follow `docs/source/accessibility/testing.html.md` with the actual Home Assistant version, installed custom cards and target browsers. Check fresh direct loads of Profile, Settings, native Energy, History and Map; long dialogs; keyboard and assistive technology use; mobile/zoom; preference persistence after reload and on another device; and restoring the default theme.

The Profile, sidebar, toolbar and more-info adapters depend on private component structure. They preserve native controls and fail without replacing core behaviour, but must be rechecked after Home Assistant upgrades. Authentication, installed PWA identity and native app branding are outside this module's coverage.
