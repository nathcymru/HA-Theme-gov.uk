---
title: "Components"
description: "Components for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Components

Components are reusable parts of the interface. Use native Home Assistant behaviour and the shared civica.uk tokens before adding custom code.

| Component family | Use |
| --- | --- |
| [Navigation](navigation.html) | Move between dashboards, rooms and native panels |
| [Action links](action-links.html) | Show a short group of clear dashboard destinations |
| [Buttons and forms](controls.html) | Make choices, enter settings and submit changes |
| [Device controls](devices.html) | Switch, adjust and inspect connected devices |
| [Cards](cards.html) | Group related content and actions |
| [Status and notifications](status.html) | Explain current state, problems and completed actions |
| [Notification badge](notification-badge.html) | Show new or unread items using the MOJ count pattern |
| [Dialogs](dialogs.html) | Show focused details or confirm consequential actions |
| [Charts and tables](charts.html) | Understand energy, history and trends |
| [Working chart examples](chart-examples.html) | Explore the ONS-based Energy presentation and accessible values using labelled example data |

## Required component record

For each maintained component, record its purpose, states, supported inputs, keyboard behaviour, accessible name, source pattern and local deviations. Include default, focused, disabled, pending, success, error, empty and unavailable states where relevant.

A visual resemblance to an official component is not evidence of accessibility. Test the implemented HTML and the actual Home Assistant host component.

## Composition

Do not copy multiple department stylesheets into Home Assistant and allow them to compete. Borrow the documented behaviour and hierarchy, then implement it through the single civica.uk token system. Keep all borrowed patterns in the [deviation register](../community/deviations.html).
