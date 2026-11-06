// Generates lighting/ha/govuk_lighting.yaml (a Home Assistant package) from recipes.json + rooms.json.
// Recipe data is embedded once, in the shared engine script. Rooms only contribute an area id.
import { readFileSync, writeFileSync } from 'node:fs';
import { load, validate, catalogue } from './recipes-lib.mjs';

const doc = load(); const errs = validate(doc); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const rooms = JSON.parse(readFileSync(new URL('../rooms.json', import.meta.url), 'utf8')).rooms;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Compact runtime shape derived from the canonical catalogue (never edited by hand).
const rt = {};
for (const r of catalogue(doc)) {
  const base = { cat: r.category, t: r.transitionS ?? 1, b: r.brightnessPct ?? 100 };
  if (r.category === 'white') rt[r.id] = { ...base, k: r.kelvin };
  else if (r.category === 'color') rt[r.id] = { ...base, colors: [{ hue: r.hue, innr: r.innr }] };
  else rt[r.id] = {
    ...base, interval: r.intervalS ?? null, flashing: !!r.safety?.flashing, max_s: r.safety?.maxRuntimeS ?? 0,
    colors: r.palette.filter((p) => !p.kelvin).map((p) => ({ hue: hexRgb(p.hue), innr: hexRgb(p.innr), b: p.brightnessPct ?? 100 })),
    white_k: r.palette.find((p) => p.kelvin)?.kelvin ?? 2700,
  };
}

const q = (s) => JSON.stringify(s);
const MEMBERS = `{% set ns = namespace(l=[]) %}{% for e in area_entities(area) if e.startswith('light.') %}{% set m = state_attr(e,'entity_id') %}{% set ns.l = ns.l + (m | list if m else [e]) %}{% endfor %}{% for e in include %}{% set ns.l = ns.l + [e] %}{% endfor %}{{ ns.l | unique | reject('in', exclude) | reject('in', label_entities('govuk_lighting_reserved')) | sort | list }}`;

const engine = `
script:
  govuk_lights_engine:
    alias: "GOV.UK lights: engine (internal, called by room wrappers)"
    mode: parallel
    max: 20
    fields:
      room: {description: "Room id"}
      area: {description: "Home Assistant area id"}
      recipe: {description: "Recipe id"}
      brightness: {description: "Optional brightness percent override"}
      include: {description: "Extra light entity ids"}
      exclude: {description: "Light entity ids to ignore"}
    sequence:
      - variables:
          recipes: ${JSON.stringify(rt)}
          include: "{{ include | default([], true) }}"
          exclude: "{{ exclude | default([], true) }}"
          rec: "{{ recipes[recipe] }}"
          owner: "input_text.govuk_lights_{{ room }}"
      - condition: template
        value_template: "{{ rec is defined and rec is mapping }}"
      # Flashing scenes need an explicit opt-in helper; refuse otherwise.
      - condition: template
        value_template: "{{ not rec.flashing or is_state('input_boolean.govuk_lights_allow_flashing','on') }}"
      - action: input_text.set_value
        target: {entity_id: "{{ owner }}"}
        data: {value: "{{ recipe }}"}
      - variables: {started: "{{ now().timestamp() }}"}
      - repeat:
          sequence:
            - variables:
                lights: >-
                  ${MEMBERS.replace(/\n/g, ' ')}
                step: "{{ repeat.index - 1 }}"
            # After the first pass, only drive lights that are still on. A light turned off in Home
            # Assistant's own dialog stays off; when none are left, the room releases the recipe.
            - variables:
                active: "{{ lights if step == 0 else lights | select('is_state','on') | list }}"
            - if: "{{ step > 0 and active | length == 0 }}"
              then:
                - action: input_text.set_value
                  target: {entity_id: "{{ owner }}"}
                  data: {value: stopped}
                - stop: "All lights in the room were turned off"
            - repeat:
                for_each: "{{ active }}"
                sequence:
                  - variables:
                      e: "{{ repeat.item }}"
                      i: "{{ repeat.index - 1 }}"
                      modes: "{{ state_attr(e,'supported_color_modes') or [] }}"
                      brand: "{{ 'innr' if 'innr' in ((device_attr(e,'manufacturer') or '') | lower) else 'hue' }}"
                      can_color: "{{ modes | select('in', ['hs','xy','rgb','rgbw','rgbww']) | list | length > 0 }}"
                      can_ct: "{{ 'color_temp' in modes }}"
                      can_dim: "{{ can_color or can_ct or 'brightness' in modes or 'white' in modes }}"
                      # brightness may be missing, none or a string; fall back to the recipe's own level.
                      pct: >-
                        {% set b = brightness | default(0, true) | int(0) %}{{ b if 0 < b <= 100 else rec.b | int(100) }}
                      tr: "{{ rec.t }}"
                  - condition: template
                    value_template: "{{ states(e) not in ['unavailable','unknown'] }}"
                  - choose:
                      - conditions: "{{ rec.cat == 'white' and (can_ct or can_color) }}"
                        sequence:
                          - action: light.turn_on
                            target: {entity_id: "{{ e }}"}
                            data:
                              color_temp_kelvin: >-
                                {% set k = rec.k[brand] %}{% set lo = state_attr(e,'min_color_temp_kelvin') %}{% set hi = state_attr(e,'max_color_temp_kelvin') %}{{ [[k, lo or k] | max, hi or k] | min }}
                              brightness_pct: "{{ pct }}"
                      - conditions: "{{ rec.cat == 'color' and can_color }}"
                        sequence:
                          - action: light.turn_on
                            target: {entity_id: "{{ e }}"}
                            data: {rgb_color: "{{ rec.colors[0][brand] }}", brightness_pct: "{{ pct }}"}
                      - conditions: "{{ rec.cat == 'scene' and can_color and rec.colors | length > 0 }}"
                        sequence:
                          - action: light.turn_on
                            target: {entity_id: "{{ e }}"}
                            data:
                              rgb_color: "{{ rec.colors[(i + step) % (rec.colors | length)][brand] }}"
                              brightness_pct: "{{ rec.colors[(i + step) % (rec.colors | length)].b }}"
                              transition: "{{ tr }}"
                      - conditions: "{{ rec.cat == 'scene' and can_ct }}"
                        sequence:
                          - action: light.turn_on
                            target: {entity_id: "{{ e }}"}
                            data: {color_temp_kelvin: "{{ rec.white_k }}", brightness_pct: 60, transition: "{{ tr }}"}
                    default:
                      - if: "{{ can_dim and rec.cat != 'color' }}"
                        then:
                          - action: light.turn_on
                            target: {entity_id: "{{ e }}"}
                            data: {brightness_pct: "{{ 60 if rec.cat == 'scene' else pct }}"}
            - delay: "{{ [ (rec.interval if rec.interval is not none else rec.t), 0.5 ] | max }}"
          while:
            # Static recipes run once. Scenes loop only while this room still owns the recipe,
            # so a newer apply or an external stop ends the old loop at its next check.
            - condition: template
              value_template: "{{ rec.cat == 'scene' or repeat.index == 1 }}"
            - condition: template
              value_template: "{{ states(owner) == recipe }}"
            - condition: template
              value_template: "{{ rec.max_s == 0 or (now().timestamp() - started) < rec.max_s }}"
      - action: input_text.set_value
        target: {entity_id: "{{ owner }}"}
        data: {value: "{{ recipe if rec.cat != 'scene' else 'stopped' }}"}
`;

// A manual change from the card wins over an automation that also drives the room. The room lists
// the scripts to stop ("interrupts") and the flags to clear ("release"); nothing else is coupled.
const manual = (r) => {
  let o = '';
  if (r.interrupts?.length) o += `\n      - action: script.turn_off\n        continue_on_error: true\n        target: {entity_id: ${q(r.interrupts)}}`;
  if (r.release?.length) o += `\n      - action: input_boolean.turn_off\n        continue_on_error: true\n        target: {entity_id: ${q(r.release)}}`;
  return o;
};
const wrappers = rooms.map((r) => `
  govuk_lights_room_${r.id}:
    alias: "GOV.UK lights: ${r.name}"
    mode: restart   # restarts only this room
    fields:
      recipe: {description: "Recipe id"}
      brightness: {description: "Optional brightness percent"}
    sequence:${manual(r)}
      - action: script.govuk_lights_engine
        data:
          room: ${q(r.id)}
          area: ${q(r.area)}
          recipe: "{{ recipe }}"
          brightness: "{{ brightness | default(none) }}"
          include: ${q(r.include ?? [])}
          exclude: ${q(r.exclude ?? [])}
`).join('');

const dispatch = `
  govuk_lights_apply:
    alias: "GOV.UK lights: apply recipe to room"
    mode: parallel
    max: 20
    fields:
      room: {description: "Room id", required: true}
      recipe: {description: "Recipe id", required: true}
      brightness: {description: "Optional brightness percent"}
    sequence:
      - action: "script.govuk_lights_room_{{ room }}"
        data:
          recipe: "{{ recipe }}"
          brightness: "{{ brightness | default(none) }}"
  govuk_lights_stop:
    alias: "GOV.UK lights: stop room scene"
    description: "Ends any scene in the room. With turn_off, every light is first set to default warm white and then switched off, so the next Turn on is white."
    mode: parallel
    max: 20
    fields:
      room: {description: "Room id", required: true}
      turn_off: {description: "Also switch the room's lights off"}
    sequence:
      - action: input_text.set_value
        target: {entity_id: "input_text.govuk_lights_{{ room }}"}
        data: {value: "stopped"}
      - action: script.turn_off
        target: {entity_id: "script.govuk_lights_room_{{ room }}"}
      - variables:
          interrupts: "{{ ${JSON.stringify(Object.fromEntries(rooms.map((r) => [r.id, r.interrupts ?? []]))).replace(/"/g, "'")}[room] }}"
          release: "{{ ${JSON.stringify(Object.fromEntries(rooms.map((r) => [r.id, r.release ?? []]))).replace(/"/g, "'")}[room] }}"
      - if: "{{ interrupts | length > 0 }}"
        then:
          - action: script.turn_off
            continue_on_error: true
            target: {entity_id: "{{ interrupts }}"}
      - if: "{{ release | length > 0 }}"
        then:
          - action: input_boolean.turn_off
            continue_on_error: true
            target: {entity_id: "{{ release }}"}
      - if: "{{ turn_off | default(false, true) | bool(false) }}"
        then:
          - variables:
              area: >-
                {{ ${JSON.stringify(Object.fromEntries(rooms.map((r) => [r.id, r.area]))).replace(/"/g, "'")}[room] }}
              include: "{{ [] }}"
              exclude: "{{ [] }}"
              lights: >-
                ${MEMBERS}
          - if: "{{ lights | length > 0 }}"
            then:
              # Reset to default white first (instant, no transition) so a later plain
              # Turn on never resumes the scene's last colour.
              - repeat:
                  for_each: "{{ lights }}"
                  sequence:
                    - variables:
                        e: "{{ repeat.item }}"
                        modes: "{{ state_attr(e,'supported_color_modes') or [] }}"
                        can_ct: "{{ modes | select('in', ['color_temp','hs','xy','rgb','rgbw','rgbww']) | list | length > 0 }}"
                    - if: "{{ states(e) not in ['unavailable','unknown'] and can_ct }}"
                      then:
                        - action: light.turn_on
                          target: {entity_id: "{{ e }}"}
                          data:
                            color_temp_kelvin: >-
                              {% set lo = state_attr(e,'min_color_temp_kelvin') %}{% set hi = state_attr(e,'max_color_temp_kelvin') %}{{ [[2700, lo or 2700] | max, hi or 2700] | min }}
                            brightness_pct: 100
                            transition: 0
              - action: light.turn_off
                target: {entity_id: "{{ lights }}"}
`;
const helpers = `
input_boolean:
  govuk_lights_allow_flashing:
    name: "GOV.UK lights: allow flashing scenes"
input_text:
${rooms.map((r) => `  govuk_lights_${r.id}:\n    name: "GOV.UK lights: ${r.name} active recipe"\n    max: 64`).join('\n')}
`;
writeFileSync(new URL('../ha/govuk_lighting.yaml', import.meta.url), `# GENERATED by lighting/scripts/generate-ha.mjs. Do not edit.\n${helpers}${engine}${wrappers}${dispatch}`);
