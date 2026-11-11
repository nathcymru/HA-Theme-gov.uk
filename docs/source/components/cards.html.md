---
title: "Cards"
description: "Cards for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Cards

Use a card to group related information and actions. A card has a meaningful heading, useful content and a clear relationship between state and control.

## Choose the right card

| Type | Purpose | Example |
| --- | --- | --- |
| Navigation card | Open a destination | Kitchen overview |
| Device card | Inspect and control one device or coherent group | Living room lights |
| Information card | Show a reading or summary | Indoor temperature |
| Chart card | Show a useful trend with context | Electricity use today |
| Status card | Explain a problem or important condition | Front door unavailable |

## Interaction

A navigation card can have one clear heading link. A card with several actions must not be wrapped in one large link. Keep separate controls separately focusable and avoid nested interactive elements.

Use the same heading alignment, padding, border and surface tokens across maintained cards. Do not give every sensor a different accent colour.

## Visual hierarchy

Use a quiet 1px structural edge where an outer boundary is needed. Separate internal groups with space and headings before adding another rule. A sensor reading, section title or status line does not need an ink box. Preserve stronger boundaries on actual inputs and clear focus on every action. See the [border roles](../styles/layout.html#surfaces-and-borders).

Repeated actions should have a clear hierarchy: one main action for the current task, quieter secondary actions and visible text for their meaning. Removing a heavy outline must not make a button indistinguishable from static text. Keep the existing floor plan's room hit regions and state labels independent of the decorative card edge.

The maintained lighting card uses 15px content gutters on small screens and 20px above 640px, with 15px separation around room rows. Scene actions use the secondary button treatment and labelled native icons; the scene group does not add another heavy vertical inset rule. These are bounded density choices for this card, not global overrides of every native HA layout.

## Images and values

Room photos and device artwork may help identification. Keep text readable outside the image. Always show units and the meaning of a numeric value. An isolated “23” is not a useful sensor summary.

## Responsive layout

Allow the content to determine height. Cards can stack in a single column. A long device name must wrap without hiding its state or pushing controls outside the card.

## Source and local decisions

[NHS cards](https://service-manual.nhs.uk/design-system/components/card) support grouped content, imagery and actions and warn against wrapping an entire card in an anchor. [MoJ cards](https://design-patterns.service.justice.gov.uk/components/card/) inform simple dashboard links, but are currently experimental. Home Assistant device cards are a local extension with additional interaction states.
