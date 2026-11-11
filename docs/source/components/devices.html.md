---
title: "Device controls"
description: "Device controls for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Device controls

Home control requires continuous and repeated actions that are uncommon in a government transaction. Keep native HA switches, sliders, media controls and climate controls when they serve the user's task.

## Switches

Show the device name and current state. A switch reports its checked state programmatically and works with the keyboard. Never use a disabled-looking off state that makes an available control appear unavailable.

Use pending feedback if state confirmation takes time. Restore the real state and show an error if the action fails.

## Sliders

A slider has a visible label, current value, unit and usable keyboard steps. Temperature and brightness need meaningful minimum, maximum and increment settings. Avoid a custom drag-only control.

Keep a numeric or native detailed-control route where precise adjustment matters. Do not replace a native input with a decorative gauge.

## Climate and media

Preserve modes and domain-specific state meanings. Heating, cooling, paused, playing and unavailable are not interchangeable brand accents. Media artwork remains useful content, not a surface to recolour with CSS filters.

Make the main action easy to identify while retaining secondary controls in the native details view. Keep device-specific safety confirmations and permissions.

## Locks, alarms and covers

Use unambiguous action labels. Display the current confirmed state and pending operation distinctly. Preserve confirmations for consequential actions. Do not place a whole-card tap target over separate lock or alarm buttons.

## Unavailable devices

Keep the device identifiable. Show “Unavailable” in text and prevent commands that cannot currently run. Explain recovery only when the application knows a useful next step. Do not show missing readings as zero or treat an unknown lock state as unlocked.

These are local HA extensions. Their common visual and writing rules remain governed by [controls](controls.html), [status](status.html) and [content design](../styles/content.html).
