---
title: "Action links"
description: "Clear navigation to Home Assistant pages and existing dashboard pop-ups."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Action links

Use `custom:civica-action-links` for a short group of useful destinations on a dashboard. Each link has an underlined name and a decorative arrow in a soft circle. The group has no card box or built-in heading. Place it beneath the dashboard's own heading.

Use a link for navigation. Use a [button](controls.html) to operate a device or submit a change. This component does not call services, change devices or create pop-ups.

## Add links

Install the [civica.uk companion module](../get-started/install.html) from version 1.1.0. The action-link component is included in the same `civica-ui.js` file as the colour settings. Add a manual card:

```yaml
type: custom:civica-action-links
links:
  - name: Housework
    path: /dashboard-housework/home
  - name: Lights
    path: '#lights'
  - name: Heating and hot water
    path: '#heating'
```

Replace these examples with destinations that exist in your installation. A fragment such as `#lights` only opens a pop-up when your dashboard already provides that behaviour. Quote fragment values in YAML so the `#` is not treated as a comment.

| Setting | Required | Meaning |
| --- | --- | --- |
| `links` | Yes | A non-empty list of destinations |
| `links[].name` | Yes | Visible, meaningful text such as “Housework” |
| `links[].path` | Yes | A local path beginning with `/`, or a non-empty current-page fragment beginning with `#` |

External URLs, protocol-relative addresses, backslashes, blank names and whitespace inside paths are rejected. Use an encoded path when a URL needs a space. Names are rendered as text, never HTML. An invalid replacement configuration leaves the existing valid links intact.

## Behaviour and accessibility

These are real HTML links with `href` destinations. Enter activates the focused link; browser context menus, modifier keys and back history work normally. Ordinary navigation stays in the same tab and can reload Home Assistant. Current-page fragments use the browser's native hash navigation and `hashchange` event. The component does not reimplement Home Assistant's private navigation function.

Labels use 19px bold text and remain underlined at rest. Every target is at least 44px high. Links wrap onto further rows on narrow screens and long labels can wrap within the available width. The 24px original SVG arrow has a 2px stroke and sits inside a 40px circle. It is hidden from assistive technology so the visible link text provides the accessible name.

Hover and touch-down states strengthen the underline. Keyboard focus uses yellow and ink, including while hovered. The circle mixes 20% of the supplied palette primary with the card surface, giving it a clear, soft tint. The arrow uses the main text colour (ink in light mode, white in dark mode), while the label uses the accessible link colour. Light and dark modes are separate from the Vivid and Muted choices. Forced-colour mode uses system colours.

Visited and unvisited links have the same appearance because dashboard content changes frequently. There is no disabled, pending, success or error action state: every configured item is a navigation link. Configuration errors are reported through Home Assistant's card configuration flow.

## Source and verification

The [GOV.UK publishing action-link pattern](https://components.publishing.service.gov.uk/component-guide/action_link) and [GOV.UK link guidance](https://design-system.service.gov.uk/styles/links/) inform the hierarchy and interaction. This is a local implementation with an original simple arrow, not copied GOV.UK artwork. It uses civica.uk typography and palette tokens.

Browser tests cover accessible names, keyboard focus, native navigation and history, invalid destinations, safe text rendering, 320px reflow, forced colours, and link/arrow contrast across all 20 palettes in both modes. Check the actual destination and any existing pop-up in the live Home Assistant dashboard before release.
