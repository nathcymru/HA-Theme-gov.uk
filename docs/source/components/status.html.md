---
title: "Status and notifications"
description: "Status and notifications for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Status and notifications

Status explains what is happening. An action lets the user change it. Keep the distinction visible and programmatic.

## State vocabulary

| State | Meaning | Presentation |
| --- | --- | --- |
| Normal | A confirmed expected state | Plain text and normal surface |
| Success | A requested action completed | Brief confirmation with semantic success token |
| Warning | Attention may be needed | Specific explanation and appropriate action |
| Error | An action or data request failed | Error text and recovery route |
| Unavailable | The current state cannot be obtained | Explicit label; do not invent a value |
| Empty | The request succeeded but returned no items | Explain the valid empty result |
| Pending | An operation is in progress | Text feedback and restrained progress indication |

## Notifications

Use an interrupting message only when the user needs it. Routine sensor updates should not generate repeated screen-reader announcements. Use a polite live region for a settings change; reserve urgent announcement behaviour for actual urgent events.

A success message cannot appear before the service confirms success. A warning must say what it concerns. Red, green or yellow alone does not carry the meaning.

## Tags and badges

A status tag is not a button. Give it a text label and avoid underlining it like a link. Notification counts should have a meaningful accessible name, including what the count represents.

## Household alerts

Do not copy national-emergency or mourning categories into ordinary home status. A household issue needs direct wording such as “Water detected in the kitchen” or “Smoke alarm unavailable”. Keep a link to details when useful.

Source patterns: [GOV.UK notification banner](https://design-system.service.gov.uk/components/notification-banner/), [tag](https://design-system.service.gov.uk/components/tag/) and [DWP status design](https://design-system.dwp.gov.uk/design-for/status).
