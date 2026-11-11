---
title: "Errors and recovery"
description: "Errors and recovery for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Errors and recovery

Help the user understand whether a task failed, data are missing or there is simply nothing to show.

## Use the right state

| Situation | Explain | Avoid |
| --- | --- | --- |
| Successful request with no warnings | No current warnings | Unavailable |
| Sensor has no current reading | Reading unavailable | 0 |
| Device command failed | The device did not respond | Success confirmation |
| Theme was not installed | This theme is not available. Reload themes after installing it. | Silent fallback to a different palette |
| Profile adapter cannot attach | Use the native theme selector or settings card | Hiding the native settings |

## Keep context

Retain entered values and the device or setting name. Place the message near the relevant control. Keep recovery steps short and specific. Offer a retry only if it performs a real retry.

## Avoid repeated interruptions

Do not announce every sensor refresh. A persistent unavailable state can remain visible without producing a new alert each time the application updates. Respect reduced motion and avoid flashing warnings.

## Provide useful diagnostics

For maintainers, record the Home Assistant version, browser version, selected theme, affected component and reproduction steps. Keep credentials, tokens, addresses and private device details out of screenshots and issue logs unless the user deliberately provides them for diagnosis.

The [status component](../components/status.html) defines shared labels and semantic treatment. GOV.UK [error messages](https://design-system.service.gov.uk/components/error-message/) inform clear placement and corrective wording.
