# GOV.UK house lighting: card, recipes and scene controller

Three separate parts. Only the card needs the browser; scenes run inside Home Assistant.

| Part | Where | What it does |
| --- | --- | --- |
| Recipes | `lighting/recipes/recipes.json` | The one canonical list: 4 whites, 7 colours, 5 dynamic scenes. Edit only this file. |
| Engine | `lighting/engine/` | Finds a room's lights from its Home Assistant **Area**, works out what they can do, and decides whether each recipe is full, adaptive or unsupported. |
| Controller | `lighting/ha/govuk_lighting.yaml` (generated) | Home Assistant scripts that run scenes. One restart-mode script per room, so rooms never cancel each other. |
| Card | `card/` | `custom:govuk-house-lighting-card`: room list, settings dialog, floor plan. |

Run `npm install`, then `npm run generate` after editing recipes or `lighting/rooms.json`, `npm run build` for the card, `npm test` and `npm run typecheck` to check.

## Install

1. Copy `card/dist/govuk-house-lighting-card.js` and the folder `card/assets/` into `config/www/govuk-lighting/` (keep `assets/` one level above the JS, i.e. `www/govuk-lighting/dist/…js` and `www/govuk-lighting/assets/floorplan.png`).
2. **Settings > Dashboards > Resources > Add**: `/local/govuk-lighting/dist/govuk-house-lighting-card.js`, type JavaScript module.
3. Copy `lighting/ha/govuk_lighting.yaml` to `config/packages/` and make sure packages are loaded:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
4. Restart Home Assistant. Add the card: `type: custom:govuk-house-lighting-card`.

The card needs no HACS card, card-mod or floor-plan add-on. HACS is not involved at runtime.

## How rooms and capabilities work

- A room is a Home Assistant **Area**. Put a new lamp in the area and the card and controller pick it up. No capability settings anywhere.
- Lights count through their device's area, an entity's own area override, and light groups (members count; the group itself never does).
- Optional per room: `entities`, `include`, `exclude`.
- Each recipe per room is **full** (every light can do it), **adaptive** (still selectable; colour lights get colours, white lights get white, brightness-only lights get brightness) or **unsupported** (disabled with a reason). Solid colours need every light in the room to show colour, and unavailable lights block them.
- Only the link between a floor-plan region and its area is configured (`card/src/rooms.json`).

Card config (all optional):

```yaml
type: custom:govuk-house-lighting-card
title: House lighting
rooms:
  - { id: lounge, name: Lounge, area: lounge }
  - { id: study, name: Office, area: study, exclude: [light.example_lamp] }
```

`id` must be one of the six floor-plan regions: `lounge`, `kitchen`, `bathroom`, `hall`, `study`, `bedroom`.

## Use a recipe from anything else

```yaml
action: script.govuk_lights_apply
data: { room: lounge, recipe: christmas, brightness: 70 }
```
```yaml
action: script.govuk_lights_stop
data: { room: lounge, turn_off: true }
```
Recipe ids: `candlelight warm_white daylight cool_white red orange yellow green cyan blue purple rugby football halloween christmas emergency`. The same data is in `lighting/generated/recipes.json` and `recipes.ts`.
Room state: `input_text.govuk_lights_<room>` holds the active recipe id (or `stopped`).

## Safety and ownership

- Emergency flashes red and blue. It is blocked unless `input_boolean.govuk_lights_allow_flashing` is on (the card asks first), and stops after 60 seconds. The card itself never flashes.
- A scene loop runs only while the room's `input_text` still holds its recipe id. A newer apply, Stop, or Turn off ends it at the next cycle. If someone else changes the lights, the scene may overwrite them on its next cycle until stopped. Stop it, or use Turn off.
- The card shows "custom" when lights are on but no recipe owns them, and the entities' real on/off/unavailable state always wins.

## Lights owned by another automation

A light that another automation writes to must not also be driven by scenes: two writers fight, and a watchdog will keep undoing the scene. Mark such a light with the Home Assistant **label** `govuk_lighting_reserved` (Settings > Areas, labels & zones > Labels, then add it to the entity).

- The card and the scripts both skip reserved lights, including for Turn on, Turn off and Stop.
- A room whose lights are all reserved shows "Managed by another automation".
- Nothing in the other automation needs to change.

## Floor plan

`card/assets/floorplan.png` is the approved image, unmodified (SHA-256 in `floorplan.png.sha256`, checked by `npm test`). The SVG uses its real pixel size (1448×1086) as the `viewBox`. Room regions in `card/src/rooms.json` were traced by eye against the image and checked on an overlay; edges near wall tops and the angled bedroom wall are approximate, not pixel-perfect. Lit rooms are tinted with the recipe's effective palette; off rooms are darkened.

## Not yet verified

- The generated scripts are syntax-checked only (`npm run check:ha`, needs `pyyaml` and `jinja2`). They have not been run on a live Home Assistant.
- No hardware test has been done. Real Hue and Innr command rates for 0.5 s flashing are untested; `intervalS` for Emergency is in the recipe file.
- Light-group changes inside a running scene are picked up at the next cycle (membership is re-read each loop); there is no restart-time recovery beyond the helper state.
- Colour accuracy depends on the bulbs; RGB values are targets, not calibrated output.
