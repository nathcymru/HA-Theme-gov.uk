---
title: "Layout and spacing"
description: "Layout and spacing for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Layout and spacing

Use a predictable page structure: navigation, heading, useful summary, primary controls and supporting detail. Put urgent household information before routine monitoring.

## Spacing scale

Use a 5px base scale: 5, 10, 15, 20, 25, 30, 40, 50 and 60px. Prefer 15px or 20px within a card, 20px or 30px between related groups and 40px or more between page sections. The purpose is a consistent relationship between elements, not a requirement to override every native padding value.

This adapts [GOV.UK spacing](https://design-system.service.gov.uk/styles/spacing/) to Home Assistant's existing grid.

## Dashboard layout

Use Home Assistant's native responsive sections/grid. Group by the user's task or room. Keep cards aligned and use headings to identify groups. A single card should not contain unrelated heating, security, energy and media controls merely to fill space.

Avoid fixed heights for text cards. Use a single column when needed. Do not force a desktop-wide dashboard to shrink into unreadable miniatures on a phone.

## Surfaces and borders

Use flat canvas and card surfaces, square or tightly controlled corners and visible borders. Avoid gradients, decorative glow and large ambient shadows. A restrained bottom edge may indicate a pressable primary button; it is not a floating-card aesthetic.

Keep 2px boundaries on editable fields where needed to make their extent clear. Separate decorative card borders from essential control boundaries: the latter need stronger contrast.

## Responsive behaviour

Test at 320 CSS pixels, 200% text zoom and 400% page zoom. Navigation may wrap or collapse through its native behaviour. Tables and genuinely two-dimensional charts can scroll within their own labelled region; the whole page must not acquire accidental horizontal scrolling.

Do not lock body scrolling or hide native navigation to make a screenshot appear cleaner. Preserve the user's route back to Home Assistant settings and dashboards.

## Density

A home control dashboard can be denser than a single-task government form. This is a controlled adaptation for repeat use. Retain readable labels and at least 44px control targets in maintained custom UI. Avoid reducing text or hit targets to show more cards.
