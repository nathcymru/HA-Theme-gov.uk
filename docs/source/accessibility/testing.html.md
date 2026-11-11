---
title: "Test the interface"
description: "Test the interface for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Test the interface

Record the exact repository revision, Home Assistant version, browser, viewport and installed custom-card versions. A passing local fixture is not evidence of a deployed Home Assistant session.

## Automated checks

Run the repository's documented validation commands for generated palette/theme parity, syntax and contrast. Build this documentation with `bundle exec middleman build`. Validate generated links and check that no GOV.UK crown, logotype or font assets are published.

Meaningful browser tests should cover actual behaviour: palette changes map to the correct available theme; the Muted control preserves the palette; native mode stays unchanged; unsupported themes do not fail silently; switching away restores the interface.

## Keyboard and screen reader

Use Tab, Shift+Tab, Enter, Space and arrow keys. Check the palette select, Muted control, native theme selector, sidebar, dialogs and representative device controls. Verify the visible label, role and state. Close a dialog and confirm focus returns to its trigger.

Check that a palette update is announced once and that sensor refreshes do not flood the live region. Verify that unavailable and empty states are spoken meaningfully.

## Responsive and visual checks

Check desktop, tablet and 320px phone layouts, 200% text enlargement, 400% zoom, reduced motion and forced colours. Review every palette/variant combination against real text, inputs, focus, error and success states. Check light, dark and automatic preferences separately.

Inspect the supplied logo and favicon at their real sizes. Confirm that no stretched mark, clipped heading, hidden action, lost chart label or accidental page overflow appears.

## Native Home Assistant checks

Open each route directly in a fresh session, before visiting a dashboard:

- Overview and a representative room dashboard.
- Native Energy, including date changes and data detail.
- History and charts.
- Map, including attribution and controls.
- Settings, profile, forms and a device details dialog.

Switch from civica to a different theme and back. Reload the browser and verify preference persistence. Test a slow or disconnected device without interpreting missing data as zero.

## Release evidence

Record checks as passed, failed or not tested, with links to screenshots or logs where useful. Keep a separate list of unsupported third-party components. Do not turn an untested item into a pass because the common tokens are correct.
