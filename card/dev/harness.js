// Dev-only fixture harness: fake hass with mixed hardware. Not shipped.
import '../dist/govuk-house-lighting-card.js';
const { themes } = await (await fetch('../../design-system/themes.json')).json();
const themeSelect = document.getElementById('preview-theme');
const modeSelect = document.getElementById('preview-mode');
for (const name of Object.keys(themes)) {
  const option = document.createElement('option'); option.value = name; option.textContent = name; themeSelect.append(option);
}
function applyPreviewTheme() {
  const theme = themes[themeSelect.value];
  for (const [name, value] of Object.entries({ ...theme, ...theme.modes[modeSelect.value] })) {
    if (typeof value === 'string' && !name.startsWith('card-mod')) document.documentElement.style.setProperty(`--${name}`, value);
  }
}
themeSelect.addEventListener('change', applyPreviewTheme); modeSelect.addEventListener('change', applyPreviewTheme); applyPreviewTheme();
const S = (id, st, modes, extra = {}) => ({ entity_id: id, state: st, attributes: { supported_color_modes: modes, ...extra } });
const states = {
  'light.l1': S('light.l1', 'on', ['brightness']), 'light.l2': S('light.l2', 'off', ['color_temp', 'xy'], { min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500 }),
  'light.h1': S('light.h1', 'off', ['color_temp', 'xy']), 'light.h2': S('light.h2', 'off', ['color_temp', 'xy']),
  'light.b1': S('light.b1', 'on', ['color_temp', 'xy']), 'light.o1': S('light.o1', 'unavailable', ['brightness']), 'light.h3': S('light.h3', 'on', ['color_temp', 'xy']), 'light.hue': S('light.hue', 'unavailable', ['color_temp', 'xy']),
  'light.govuk_lights_lounge': S('light.govuk_lights_lounge', 'on', ['color_temp', 'xy'], { entity_id: ['light.l1', 'light.l2'] }), 'input_text.govuk_lights_lounge': { entity_id: 'x', state: 'christmas', attributes: {} }, 'input_text.govuk_lights_bedroom': { entity_id: 'x', state: 'warm_white', attributes: {} },
};
const areas = { l1: 'lounge', l2: 'lounge', h1: 'hall', h2: 'hall', b1: 'bedroom', o1: 'study', h3: 'hall', hue: 'hall' };
const entities = {}, devices = {};
for (const [k, a] of Object.entries(areas)) { entities['light.' + k] = { entity_id: 'light.' + k, device_id: 'd' + k }; if (k === 'h1') entities['light.' + k].labels = ['govuk_lighting_reserved']; // Spot 1 (door warning) stays with the front-door automation
  devices['d' + k] = { id: 'd' + k, area_id: a, manufacturer: k.startsWith('h') ? 'Innr' : 'Signify' }; }
const card = document.createElement('civica-house-lighting-card');
card.setConfig({ type: 'custom:civica-house-lighting-card' });
window.calls = [];
window.fixtureHass = { states, entities, devices, callService: async (domain, service, data, target) => {
  window.calls.push({ domain, service, data, target });
  if (window.failNext) throw new Error('fixture failure');
  document.getElementById('preview-message').textContent = 'Action requested in this preview. No real devices were changed.';
} };
card.hass = window.fixtureHass;
document.getElementById('mount').append(card);
window.card = card;
card.addEventListener('hass-more-info', (e) => { document.getElementById('preview-message').textContent = `Home Assistant would open the native controls for ${e.detail.entityId}.`; });
