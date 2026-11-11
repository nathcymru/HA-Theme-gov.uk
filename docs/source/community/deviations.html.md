---
title: "Controlled deviations"
description: "Controlled deviations for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Controlled deviations

A deviation has a user need, a documented boundary and a verification requirement. It is not permission for each card to invent its own style.

| ID | Local decision | User need | Boundary and verification |
| --- | --- | --- | --- |
| CIV-001 | civica.uk replaces government identity | Independent home software must be clearly identified | No crown, GOV.UK logotype, GDS Transport or official-service implication; inspect assets and built output |
| CIV-002 | Ten palettes, each Vivid/Muted | Personal appearance preference | Exact supplied primary/canvas values; preserve semantic colours; test every pairing |
| CIV-003 | Repeated-use device icons | Faster recognition of rooms and devices | Native domain vocabulary; labels and accessible names; official symbols only within their documented component purpose |
| CIV-004 | Native switches, sliders, climate and media controls | Direct, repeated home control | Preserve keyboard/value semantics and native behaviour |
| CIV-005 | Dashboard cards and denser grids | Monitor and control related information | Follow NHS grouping; no nested interactions; narrow-screen reflow |
| CIV-006 | Device-detail modal dialogs | Focused control without losing context | Preserve focus trap, cancellation and return; MoJ source remains experimental |
| CIV-007 | ONS chart patterns on the native Energy renderer | Understand measured change and use without losing HA functionality | Apply ONS geometry and context through a reversible ECharts adapter; retain native statistics, semantic energy colours, legends, keyboard interaction and date controls; provide plotted-value tables. History and arbitrary custom charts are not adapted |
| CIV-008 | Purposeful room/device/camera imagery | Identify physical context | Relevant images with text alternatives/state, no decorative filtering |
| CIV-009 | Profile component adapter | Place colour controls near native settings | Private, version-sensitive adapter; native dropdown and standalone fallback remain |
| CIV-010 | Native HA shell and component semantics retained | Keep full application capability | Do not replace native Energy/Map, routes or permission logic |
| CIV-011 | Existing native translations retained | Respect users' language choices | Apply writing standards to maintained copy; do not rewrite all host labels in English |
| CIV-012 | Middleman implementation with Design System navigation | Meet the requested documentation stack and familiar organisation | Genuine Tech Docs gem; mirror IA rather than claiming the Node source tree is Middleman |
| CIV-013 | MOJ notification badge in the native HA drawer control | Recognisable attention count without replacing notification behaviour | Preserve red rounded geometry, capped count and native accessible context; local live updates must not flood announcements |
| CIV-014 | Separate dark structural and control boundaries | Quiet grouping without losing usable controls | Dark structural `#50565A`; interactive outline `#9BA4AA`; keep input/focus contrast and test the actual surface |
| CIV-015 | Native Energy distribution diagram retained | Show household energy flow using the configured native sources | It is a Home Assistant flow diagram, not an ONS chart component. Preserve its accessible labels and native totals table; do not mislabel it as an ONS Sankey |

| CIV-016 | Generated chart colours and dense-data lines | Larger Home Assistant inventories and live signals | Opaque identity-based OKLCH colours with Vivid/Muted variants, 24 fallback slots and patterns; 2px normal/hover lines; unfilled individual Power lines. Native column stacks, values and controls remain authoritative. This extends the ONS palette and 3px line guidance |

## Review a deviation

Record the expected behaviour, test evidence, known limits and owner. Revisit the decision when Home Assistant or the source pattern changes. Remove adapters that are no longer necessary when a stable native capability becomes available.

Sources and their current statuses are listed in [the source register](sources.html).
