---
title: "Energy and history"
description: "Energy and history for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Energy and history

Keep Home Assistant's native Energy dashboard authoritative. The theme improves presentation while retaining its date controls, statistics, comparisons, device breakdowns and configured data sources.

## Preserve the native route

Use the native Energy and History panels. Do not replace them with a separate summary page that silently omits capabilities. Optional dashboard cards can offer an entry point or brief summary and link to the native detail.

## Explain the data

Distinguish power from energy, instantaneous readings from period totals, and measured values from estimates. Show the unit and time period near each value. Avoid converting missing readings to zero.

Keep tariff, currency and unit choices from the user's Home Assistant configuration. A palette is not a reason to change those preferences.

## Keep series stable

Preserve meaningful colours for grid, solar, battery and other series across palette changes. Add text context and keep labels legible. Charts need a different colour strategy from branded buttons.

## Test full behaviour

Open native Energy directly in a fresh browser session. Check previous/next date, date range, charts, legends, tooltips, tables and navigation to details. Check loading, no-data and unavailable states. Repeat on a narrow screen and with keyboard navigation.

Use the [chart component rules](../components/charts.html). ONS [chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text) informs the context around the data; its publication-specific figure numbering is not required in a home dashboard.
