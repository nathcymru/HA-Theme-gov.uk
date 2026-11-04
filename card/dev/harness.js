// Dev-only fixture harness: fake hass with mixed hardware. Not shipped.
import '../dist/govuk-house-lighting-card.js';
const S = (id, st, modes, extra = {}) => ({ entity_id: id, state: st, attributes: { supported_color_modes: modes, ...extra } });
const states = {
  'light.l1': S('light.l1', 'on', ['brightness']), 'light.l2': S('light.l2', 'off', ['color_temp', 'xy'], { min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500 }),
  'light.h1': S('light.h1', 'off', ['color_temp', 'xy']), 'light.h2': S('light.h2', 'off', ['color_temp', 'xy']),
  'light.b1': S('light.b1', 'on', ['color_temp', 'xy']), 'light.o1': S('light.o1', 'unavailable', ['brightness']),
  'input_text.govuk_lights_lounge': { entity_id: 'x', state: 'christmas', attributes: {} }, 'input_text.govuk_lights_bedroom': { entity_id: 'x', state: 'warm_white', attributes: {} },
};
const areas = { l1: 'lounge', l2: 'lounge', h1: 'hall', h2: 'hall', b1: 'bedroom', o1: 'study' };
const entities = {}, devices = {};
for (const [k, a] of Object.entries(areas)) { entities['light.' + k] = { entity_id: 'light.' + k, device_id: 'd' + k }; devices['d' + k] = { id: 'd' + k, area_id: a, manufacturer: k.startsWith('h') ? 'Innr' : 'Signify' }; }
const card = document.createElement('govuk-house-lighting-card');
card.setConfig({ type: 'custom:govuk-house-lighting-card' });
card.hass = { states, entities, devices, callService: async (d, s, data) => { console.log('callService', d, s, JSON.stringify(data)); } };
document.getElementById('mount').append(card);
window.card = card;
