# civica house lighting

The lighting card presents a floor plan and room controls. Home Assistant runs the scenes and supplies the native brightness, colour and temperature controls. The `govuk` filenames and service IDs remain for compatibility; the visible product identity is civica.

| Part | Source | Purpose |
| --- | --- | --- |
| Recipes | `lighting/recipes/recipes.json` | Canonical definitions for 4 white tones, 7 solid colours and 5 scenes. |
| Capability engine | `lighting/engine/` | Discovers room lights and adapts recipes to their capabilities. |
| Scene controller | `lighting/ha/govuk_lighting.yaml` | Generated Home Assistant scripts and helpers. Scenes run independently of the browser. |
| Native room groups | `lighting/ha/govuk_lighting_groups.yaml` | Generated light groups for whole-room native controls. |
| Card | `card/` | Floor plan, room list, state text, on/off actions, native settings and accessible errors. |

## Install

Adapting the lighting controller requires a [source checkout](https://github.com/nathcymru/civica) matching your release. The installation ZIP includes generated lighting files, but not the root npm commands or complete build source. Run the commands below from the source checkout's root directory, including when you downloaded the installation ZIP separately.

1. Run `npm ci` and `npm run package`. Extract `dist/civica.zip`.
2. Copy the archive's `www/civica/` directory to Home Assistant's `config/www/civica/`. Keep `card/dist/` and `card/assets/` alongside one another. The card loads the floor plan relative to its JavaScript module. Scene actions use Home Assistant's native icons.
3. In **Settings → Dashboards → Resources**, add `/local/civica/card/dist/civica-house-lighting-card.js?v=1.4.0` as a **JavaScript module**.
4. Review the room mappings in `lighting/rooms.json` and the group membership snapshot in `lighting/ha/area-lights.json`. They describe the original installation, so adapt them to your own entity and area IDs. Run `npm run generate` after changing them.
5. Copy the generated `lighting/ha/govuk_lighting.yaml` and `lighting/ha/govuk_lighting_groups.yaml` to your Home Assistant `config/packages/` directory. Merge package loading into the existing configuration:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

6. Restart Home Assistant and check that the scripts and room groups are available. Add a dashboard card:

   ```yaml
   type: custom:civica-house-lighting-card
   ```

The old `custom:govuk-house-lighting-card` name is still supported. Existing `/local/govuk-lighting/dist/govuk-house-lighting-card.js` installations remain supported by the compatibility import. Copy both JavaScript files to the existing `dist/` folder and keep adjacent assets at `www/govuk-lighting/assets/`. Register only one resource URL.

The card needs no card-mod or floor-plan add-on. Install the civica themes separately using the [repository installation guide](../README.md). HACS theme installation does not install this card, its assets or the controller package.

Do not install `lighting/ha/front_door.yaml` as part of a generic card installation. It is a separate, installation-specific example with real entity IDs.

## Configure rooms consistently

A room normally maps to a Home Assistant **Area**. Discovery checks an entity's area, its device's area and the members of light groups. A group is not counted again as an extra bulb.

The card and generated controller have separate configuration inputs. Keep their room IDs, areas, explicit entity lists, inclusions and exclusions aligned:

- `card/src/rooms.json` provides the card defaults; a dashboard card's `rooms` setting can override them.
- `lighting/rooms.json` provides the controller mappings; run `npm run generate` after editing it.
- `lighting/ha/area-lights.json` is a static snapshot for the native room groups. Update it and regenerate after adding, removing or moving lamps.

Changing a dashboard card's `rooms` setting alone does **not** change the controller's scene or Turn off targets. Review both configurations before using device controls.

```yaml
type: custom:civica-house-lighting-card
title: House lighting
rooms:
  - id: lounge
    name: Lounge
    area: lounge
    group: light.my_lounge_group
  - id: study
    name: Office
    area: study
    exclude:
      - light.example_lamp
```

`group` is an optional existing light-group entity ID for the native settings dialog. It does not change the controller's membership. Without it, the card checks `light.govuk_lights_<room>` for older installations and `light.lights_<room>` for newly generated groups. Home Assistant may add a numeric suffix when a name is already in use; set `group` to the actual entity ID in that case.

Room IDs must match one of the six supplied floor-plan regions: `lounge`, `kitchen`, `bathroom`, `hall`, `study` and `bedroom`. An area or explicit entity list is required for each room. A different floor plan needs matching region coordinates, not only a replacement image.

## Use the controls

Each room shows how many available, managed lights are on. Rooms with no assigned or available lights remain visible with an explanation and disabled controls. **Turn all on** includes partially lit rooms; unavailable and reserved lights are excluded. **Turn all off** requests the controller to stop and switch off each active managed room.

**Settings** opens Home Assistant's `hass-more-info` dialog for the room group. The native controls retain their keyboard handling, orientation, scrolling and responsive layout. White tones and solid colours use those native controls rather than extra tiles.

Before choosing a group, the card verifies its members, including nested groups, against the room's managed lights. If it cannot prove the group is safe—for example, it contains a reserved or unrelated light—it opens the first available managed light instead. The native dialog then controls that one light. Scene buttons are explicitly labelled with the room name and still request a room scene from the controller.

Supported scenes appear inside the native dialog as secondary actions with visible labels and 24px Home Assistant icons. A narrow decorative strip previews the light colours separately from the icon and label; it stays still when reduced motion is enabled. The enhancement is optional and depends on Home Assistant's component structure. If an update changes that structure, the native controls remain usable and the scene enhancement may be absent. There are no scene buttons in the room list.

Failures produce an error summary and an inline room message. Summary links focus the relevant error. A scene request is described as requested, not as proof that hardware changed successfully.

## Use recipes from other Home Assistant features

```yaml
action: script.govuk_lights_apply
data:
  room: lounge
  recipe: christmas
  brightness: 70
```

```yaml
action: script.govuk_lights_stop
data:
  room: lounge
  turn_off: true
```

With `turn_off: true`, the controller first requests default warm white (2700 K) where supported, then switches the room off. This avoids restoring the previous scene colour on the next ordinary Turn on.

Recipe IDs are `candlelight`, `warm_white`, `daylight`, `cool_white`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `rugby`, `football`, `halloween`, `christmas` and `emergency`. The generated JSON and TypeScript files contain the same definitions. `input_text.govuk_lights_<room>` stores the active recipe ID or stopped state.

Recipes may be fully supported, adaptive or unsupported. Adaptive scenes use suitable colours, white temperatures or brightness for the available hardware. Availability follows the capability engine; the theme palette never changes the light recipes.

## Lighting ownership and flashing

Apply the Home Assistant label `govuk_lighting_reserved` to any light controlled by an automation that must retain ownership. The card and generated scene controller exclude those lights. Native group controls are offered only when group membership is compatible with the card's exclusions. Reserved lights are not included in the displayed available-light count.

The Emergency scene flashes red and blue. It requires explicit confirmation, is blocked by the controller unless `input_boolean.govuk_lights_allow_flashing` is on, and has a 60-second runtime cap. The card preview itself does not flash. Cancelling confirmation sends no service request; a failed permission request does not start the scene.

Scene loops re-read membership and only drive lights that are still on. Turning an individual light off in Home Assistant keeps it off; when none remain on, the scene releases ownership. Other brightness or colour changes can still be overwritten on the next scene cycle until the scene stops.

The optional front-door example configures the Hall controller to interrupt `script.front_door_sequence` and clear its flags when a room scene or controller stop action takes over. The card's ordinary Turn on calls `light.turn_on` directly; it does not independently stop that door automation. Test any such interaction in your own installation before relying on it.

## Floor plan and verification

`card/assets/floorplan.png` is the existing supplied image, retained unchanged. Its SHA-256 is checked by the test suite. The SVG uses its 1448 × 1086 dimensions. Room boundaries were traced against the image; angled walls and wall tops are approximate. State text and buttons provide alternatives to the image, and reduced-motion preferences stop the animated colour preview.

Run `npm run build`, `npm run typecheck`, `npm test` and `npm run test:browser`. `npm run check:ha` checks generated YAML and template syntax using PyYAML and Jinja2.

Browser tests use sample states and a minimal native-dialog fixture. They verify component behaviour, not a live Home Assistant deployment or physical bulbs. Command rates, flashing behaviour, restart recovery and interactions with other automations require installation-specific tests. RGB values are targets, not calibrated bulb output.
