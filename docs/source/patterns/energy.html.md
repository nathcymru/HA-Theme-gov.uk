---
title: "Energy and history"
description: "Apply ONS column and line patterns to native Home Assistant Energy without changing its statistics or controls."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Energy and history

Home Assistant's native Energy dashboard remains authoritative. Apply the [civica.uk chart component](../components/charts.html) to its consumption columns and time-series charts while retaining dates, statistics, comparisons, device breakdowns and configured sources. A branded heading and different series colours are insufficient: the chart itself needs the defined typography, grid, legend and accessible data treatment.

## Preserve the native route

Use the native Energy and History panels. The optional companion adapts supported native chart presentation; theme YAML alone cannot implement the full chart pattern. Do not replace Energy with a summary page that silently omits capabilities. Dashboard summaries should link to the native detail.

In v1.3.0, the presentation adapter covers the seven specified graph cards **inside Energy**, against frontend 20261028.5. History remains native; it is not implicitly covered by those Energy selectors. The [working examples](../components/chart-examples.html) demonstrate the production adapter with synthetic data and a real ECharts renderer.

Keep Home Assistant responsible for fetching and aggregating data, converting units and calculating costs. Do not introduce additional sensor polling or write to an energy entity to create a visual demonstration. Documentation examples use clearly labelled synthetic values.

## Consumption over a period

Energy consumed in successive intervals uses **vertical stacked columns**, corresponding to ONS's [column component](https://service-manual.ons.gov.uk/design-system/components/column-chart-component). Time runs left to right; segment values retain their native stack and sign. The vertical scale includes zero. Square columns, quieter horizontal gridlines and larger horizontal labels replace decorative plot treatment.

Use the native interval and configured unit, such as kWh. Do not normalise energy totals to 100%, combine small sources into an invented “other” series, or merge import and export. Preserve the native treatment of comparison periods and forecast series. The table must expose the same period, series and values as the chart data.

The ONS [stacked-bar guidance](https://service-manual.ons.gov.uk/data-visualisation/chart-types/stacked-bar-charts) also applies to stacked columns: segments represent parts of a total, and internal segments are harder to compare because they do not share a baseline. Label the sources and keep exact values available; do not describe a colour-only stack as fully accessible.

## Power over time

Power is a rate, normally W or kW, and must not be labelled as energy. Use **individual unfilled lines**, adapting the ONS [line component](https://service-manual.ons.gov.uk/design-system/components/line-chart-component): readable labels, matching line keys and quiet value gridlines. The local width is 2px for dense live data, including hover. Remove gradient fills, cumulative display stacking and decorative smoothing from Power sources; each line represents that source’s unchanged value at that timestamp. The total-consumption line uses its neutral colour and a distinct dash. Join verified native positive/negative display pairs into one signed line by selecting their existing signed samples. Preserve the native arrays and IDs for restoration, and use the same signed projection in View data. Preserve scale, dates, missing observations and explicit stepping. Consumption columns remain stacked.

Do not smooth away peaks, shift timestamps, fill absent readings with zero or join missing intervals merely for appearance. ONS [line-chart guidance](https://service-manual.ons.gov.uk/data-visualisation/chart-types/line-chart) distinguishes missing observations from continuous data and recommends restrained markers for dense series. These rules guide authoring; the presentation adapter must not silently rewrite native data semantics.

## Energy distribution

Home Assistant's distribution diagram is a **controlled deviation**, not an ONS Sankey component. The reviewed ONS component catalogue supplies area, bar, column, line and scatter charts; it does not supply a Sankey component.

Keep Home Assistant's nodes, edges, quantities, directions and interactions. Improve the surrounding heading, label legibility and spacing consistently with the chart pattern. Do not turn household flows into a stacked bar merely to match an available component. A flow diagram answers a different question.

Provide accessible node or flow values only when the native diagram exposes them reliably. Label the alternative according to what it contains: a node-value table is not a source-to-destination flow table. Never invent edge values from node totals or count the same energy twice. If a diagram cannot be adapted safely, preserve the native display and document the narrower coverage.

The current chart adapter does not modify this diagram or add a distribution data table. Its existing labels and native presentation remain. The consumption and power improvements must not be reported as a replacement or full accessibility audit of distribution.

## Date, units and data context

Distinguish power from energy, instantaneous readings from period totals, and measured values from estimates. Show the unit and time period near each value. Avoid converting missing readings to zero.

Keep tariff, currency, number formatting, time zone and unit choices from Home Assistant. Preserve the existing previous/next controls, day/week/month/year or custom selection, and comparison behaviour available in that version. The presentation adapter does not introduce its own competing date picker.

Display the current period as context; do not hard-code “today” when the user can change the date. Distinguish local display time from the underlying timestamp. The accessible table must update when the native chart updates. Keep loading, unavailable, incomplete-period and no-data states intact, and do not retain a table of stale values beneath a newly loading chart.

## Keep series stable

Use the [chart colour generator](../styles/chart-colour.html) for meaningful energy families and stable native device identities. Colours stay stable across brand palette changes; Vivid and Muted follow the existing theme toggle. Current and comparison columns are opaque, with hatching identifying the previous period. This is an explicit adaptation of ONS's categorical colour system. Keep native source names and legend visibility state. Use readable table values and labels alongside colour; colour alone cannot distinguish every combination reliably.

## Test full behaviour

The release acceptance record must cover all of the following:

1. Open native Energy directly in a fresh session with the companion loaded. Verify changed chart options and a screenshot, not only theme variables.
2. Compare series count, names, values, timestamps, units, native column stacks and selected period before and after styling. Include zero, missing, negative and comparison values.
3. Change the date, open data, operate legends and tooltips, and use native detail navigation. Confirm the chart and alternative agree after each update.
4. Review consumption columns, power history and distribution independently. An improved column chart does not establish Sankey coverage.
5. Check light and dark modes, multiple palettes, keyboard interaction, a 320px viewport and enlarged text. Keep wide data tables contained.
6. Switch away from civica.uk, navigate away and return. Verify restoration, no duplicate tables or legends, and no retained observers on detached charts.
7. Distinguish synthetic browser coverage from live verification. Do not claim all custom chart cards or a complete screen-reader audit from one Energy screenshot.

The [ONS source record](../reference/ons-chart-sources.json) identifies the reviewed upstream code and design decisions. Compatibility with private Home Assistant elements is version-sensitive; retain native functionality when an expected interface changes.
