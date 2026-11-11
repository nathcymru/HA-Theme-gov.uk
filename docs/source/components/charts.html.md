---
title: "Charts and tables"
description: "Charts and tables for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Charts and tables

Charts help users understand change and comparison. Preserve native Home Assistant Energy and History functionality, then apply clear labels and consistent presentation.

## Required chart context

Show a concise title, the measure and unit, the time period and the data source or sensor context. Use local date and number formats. Explain estimates or missing data when they affect interpretation.

Use a textual summary or accessible data table where the maintained component can provide it. Hover-only tooltips are not an adequate sole route to values. Preserve native data access when a chart's internals cannot be changed safely.

## Choose a simple chart

Use lines for change over time and bars for comparisons or period totals. Do not add three-dimensional effects, decorative gradients or animation that obscures values. Start bar charts at zero unless a clearly explained specialist case requires otherwise.

Keep the default view useful without interaction. Add filtering or zoom only where it helps the user's question.

## Colours and series

Use stable semantic series colours across the interface. A theme palette change must not silently exchange solar, grid, battery or gas meanings. Avoid treating all series as shades of the selected brand colour.

Prefer five or fewer categorical colours. Use direct labels, markers or line styles to supplement colour. Review actual combinations: an official chart palette is not proof of sufficient contrast for every use.

## Tables

Use real table headers and a caption or nearby heading. Align numbers consistently, preserve units and distinguish a missing value from zero. Allow a genuinely wide table to scroll within its own region rather than making the whole page overflow.

## Native limitations

Theme variables can improve the chart container, typography and available chart tokens. They cannot guarantee accessible internals for every native or custom chart. Record the specific gap and preserve native functionality.

Sources: ONS [principles](https://service-manual.ons.gov.uk/data-visualisation/guidance/principles), [chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text), [chart colours](https://service-manual.ons.gov.uk/data-visualisation/colours/using-colours-in-charts) and [interactive charts](https://service-manual.ons.gov.uk/data-visualisation/guidance/interactive-charts-and-animations).
