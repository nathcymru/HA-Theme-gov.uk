import test from 'node:test';
import assert from 'node:assert/strict';
import { load, catalogue } from '../scripts/recipes-lib.mjs';
import { resolveRoomLights } from '../engine/discovery.ts';
import { assessRoom, recipeAvailability, lightCapability } from '../engine/capabilities.ts';
import { buildPlan, diffMembership } from '../engine/plan.ts';

const recipes = catalogue(load());
const R = (id) => recipes.find((r) => r.id === id);
const WHITE = ['brightness'], CT = ['color_temp'], COL = ['color_temp', 'xy'];

// Builds a snapshot from [entity, area, modes, extras] rows. Third-party/Innr/Hue differ only by manufacturer.
function snap(rows, extra = {}) {
  const s = { entities: {}, devices: {}, states: {} };
  for (const [id, area, modes, o = {}] of rows) {
    s.entities[id] = { entity_id: id, device_id: 'd_' + id, area_id: null, platform: 'x' };
    s.devices['d_' + id] = { id: 'd_' + id, area_id: area, manufacturer: o.mfr ?? 'Acme' };
    s.states[id] = { entity_id: id, state: o.state ?? 'on', attributes: { supported_color_modes: modes, min_color_temp_kelvin: o.min, max_color_temp_kelvin: o.max, ...(o.members ? { entity_id: o.members } : {}) } };
  }
  return Object.assign(s, extra);
}
const lounge = { id: 'lounge', name: 'Lounge', area: 'lounge' };
const av = (s, id, room = lounge) => assessRoom(s, room, recipes).availableRecipes.find((r) => r.recipeId === id);

test('1 adding a colour bulb to a white-only room', () => {
  const a = snap([['light.a', 'lounge', WHITE], ['light.b', 'lounge', WHITE]]);
  assert.equal(av(a, 'rugby').availability, 'unsupported');
  const b = snap([['light.a', 'lounge', WHITE], ['light.b', 'lounge', WHITE], ['light.c', 'lounge', COL]]);
  assert.equal(av(b, 'rugby').availability, 'adaptive');
  assert.equal(av(b, 'christmas').availability, 'adaptive');
});
test('2 removing a colour bulb from a mixed room', () => {
  const s = snap([['light.a', 'lounge', WHITE], ['light.c', 'lounge', COL]]);
  delete s.devices['d_light.c']; s.devices['d_light.c'] = { id: 'd_light.c', area_id: 'hall' };
  assert.equal(av(s, 'rugby').availability, 'unsupported');
});
test('3 moving a bulb between areas', () => {
  const s = snap([['light.c', 'lounge', COL]]);
  assert.deepEqual(resolveRoomLights(s, lounge), ['light.c']);
  s.devices['d_light.c'].area_id = 'hall';
  assert.deepEqual(resolveRoomLights(s, lounge), []);
  assert.deepEqual(resolveRoomLights(s, { id: 'hall', name: 'Hall', area: 'hall' }), ['light.c']);
});
test('4 renaming/replacing an entity; entity area override beats device', () => {
  const s = snap([['light.old', 'lounge', COL]]);
  s.entities['light.new'] = { entity_id: 'light.new', area_id: 'lounge' };
  s.states['light.new'] = { entity_id: 'light.new', state: 'on', attributes: { supported_color_modes: COL } };
  delete s.entities['light.old']; delete s.states['light.old'];
  assert.deepEqual(resolveRoomLights(s, lounge), ['light.new']);
  s.entities['light.new'].area_id = 'hall';
  assert.deepEqual(resolveRoomLights(s, lounge), []);
});
test('5 a group changing membership; groups never double-count', () => {
  const s = snap([['light.a', 'lounge', WHITE], ['light.b', 'lounge', COL], ['light.grp', 'lounge', WHITE, { members: ['light.a'] }]]);
  assert.deepEqual(resolveRoomLights(s, lounge), ['light.a', 'light.b']);
  s.states['light.grp'].attributes.entity_id = ['light.a', 'light.b'];
  assert.deepEqual(resolveRoomLights(s, lounge), ['light.a', 'light.b']);
  // group capabilities are not used: a white group of colour members still resolves to colour
  assert.equal(assessRoom(s, { id: 'g', name: 'g', entities: ['light.grp'] }, recipes).colorLights, 1);
});
test('6 unavailable light returning online', () => {
  const s = snap([['light.a', 'lounge', COL], ['light.b', 'lounge', COL, { state: 'unavailable' }]]);
  const r = av(s, 'red'); assert.equal(r.availability, 'unsupported'); assert.equal(r.reason, 'members_unavailable');
  s.states['light.b'].state = 'on';
  assert.equal(av(s, 'red').availability, 'full');
});
test('7 no lights to colour lights', () => {
  assert.equal(av(snap([]), 'red').reason, 'no_lights');
  assert.equal(av(snap([['light.a', 'lounge', COL]]), 'red').availability, 'full');
});
test('8 mixed Hue, Innr and third-party', () => {
  const s = snap([['light.h', 'lounge', COL, { mfr: 'Signify Netherlands B.V.' }], ['light.i', 'lounge', COL, { mfr: 'Innr' }], ['light.t', 'lounge', ['rgb'], { mfr: 'Acme' }]]);
  assert.equal(av(s, 'red').availability, 'full');
  const plan = buildPlan(R('orange'), assessRoom(s, lounge, recipes).lightCapabilities);
  const rgb = Object.fromEntries(plan.steps.map((p) => [p.entityId, p.sequence[0].rgb]));
  assert.deepEqual(rgb['light.h'], [255, 94, 0]); assert.deepEqual(rgb['light.i'], [255, 80, 0]); assert.deepEqual(rgb['light.t'], [255, 94, 0]);
});
test('9 colour scene adapts to white + colour', () => {
  const s = snap([['light.a', 'lounge', COL], ['light.b', 'lounge', CT, { min: 2000, max: 6500 }], ['light.c', 'lounge', WHITE]]);
  const p = buildPlan(R('christmas'), assessRoom(s, lounge, recipes).lightCapabilities);
  assert.equal(p.availability, 'adaptive');
  assert.deepEqual(p.steps.map((x) => x.kind), ['color', 'white', 'brightness']);
  assert.ok(!p.steps[2].sequence[0].rgb && !p.steps[2].sequence[0].kelvin, 'brightness-only light gets no colour/temperature');
});
test('10-11 solid colours toggle with white-only bulb', () => {
  const s = snap([['light.a', 'lounge', COL], ['light.b', 'lounge', COL]]);
  assert.equal(av(s, 'blue').availability, 'full');
  const w = snap([['light.a', 'lounge', COL], ['light.b', 'lounge', COL], ['light.w', 'lounge', CT]]);
  assert.equal(av(w, 'blue').reason, 'needs_all_colour');
  assert.equal(av(w, 'christmas').availability, 'adaptive');
});
test('12 running scene: membership changes revise plan, unrelated rooms untouched', () => {
  const before = ['light.a', 'light.b'];
  assert.deepEqual(diffMembership(before, ['light.a', 'light.c']), { added: ['light.c'], removed: ['light.b'], unchanged: ['light.a'] });
});
test('13 unavailable and unknown-capability devices', () => {
  const s = snap([['light.a', 'lounge', COL, { state: 'unavailable' }]]);
  const c = lightCapability(s, 'light.a'); assert.equal(c.status, 'unavailable'); assert.equal(c.color, true, 'offline keeps last-known colour support');
  s.states = {}; assert.equal(lightCapability(s, 'light.a').status, 'unknown');
  assert.equal(assessRoom(s, lounge, recipes).unknownLights, 1);
});
test('14 repeated discovery is deterministic', () => {
  const s = snap([['light.z', 'lounge', COL], ['light.a', 'lounge', COL], ['light.m', 'lounge', WHITE]]);
  const a = JSON.stringify(assessRoom(s, lounge, recipes)), b = JSON.stringify(assessRoom(s, lounge, recipes));
  assert.equal(a, b);
  assert.deepEqual(resolveRoomLights(s, lounge), ['light.a', 'light.m', 'light.z']);
});
test('15 independent rooms keep independent plans while one changes', () => {
  const s = snap([['light.l1', 'lounge', COL], ['light.o1', 'office', COL]]);
  const office = { id: 'office', name: 'Office', area: 'office' };
  const officePlan = () => JSON.stringify(buildPlan(R('christmas'), assessRoom(s, office, recipes).lightCapabilities));
  const before = officePlan();
  s.devices['d_light.l1'].area_id = 'hall'; s.states['light.l1'].state = 'unavailable';
  assert.equal(officePlan(), before);
});
test('whites: clamp, mixed fixed-white is adaptive, onoff-only unsupported', () => {
  const s = snap([['light.t', 'lounge', CT, { min: 2200, max: 6000 }], ['light.d', 'lounge', WHITE]]);
  const caps = assessRoom(s, lounge, recipes).lightCapabilities;
  const p = buildPlan(R('candlelight'), caps);
  assert.equal(p.availability, 'adaptive');
  assert.equal(p.steps[1].sequence[0].kelvin, 2200); assert.match(p.steps[1].sequence[0].adjusted, /clamped/);
  assert.equal(buildPlan(R('cool_white'), caps).steps[1].sequence[0].kelvin, 6000);
  assert.equal(av(snap([['light.o', 'lounge', ['onoff']]]), 'warm_white').availability, 'unsupported');
});
test('scene distribution: 1, 2 and 3+ colour bulbs are stable', () => {
  const mk = (n) => buildPlan(R('rugby'), assessRoom(snap(Array.from({ length: n }, (_, i) => ['light.' + 'abcd'[i], 'lounge', COL])), lounge, recipes).lightCapabilities);
  assert.equal(mk(1).steps.length, 1);
  const two = mk(2).steps; assert.notEqual(two[0].sequence[0].hex, two[1].sequence[0].hex);
  const four = mk(4).steps; assert.equal(four.length, 4); assert.deepEqual(JSON.stringify(mk(4)), JSON.stringify(mk(4)));
});
import { RESERVED_LABEL } from '../engine/discovery.ts';
test('reserved lights (owned by another automation) are never driven and are reported distinctly', () => {
  const s = snap([['light.spot', 'hall', COL], ['light.b', 'hall', COL]]);
  const hall = { id: 'hall', name: 'Hall', area: 'hall' };
  s.entities['light.spot'].labels = [RESERVED_LABEL];
  assert.deepEqual(resolveRoomLights(s, hall), ['light.b']);
  const a = assessRoom(s, hall, recipes); assert.equal(a.reservedLights, 1); assert.equal(a.totalLights, 1);
  const plan = buildPlan(R('christmas'), a.lightCapabilities);
  assert.ok(!plan.steps.some((x) => x.entityId === 'light.spot'));
  s.entities['light.b'].labels = [RESERVED_LABEL];
  const none = assessRoom(s, hall, recipes); assert.equal(none.totalLights, 0); assert.equal(none.reservedLights, 2);
  assert.equal(none.availableRecipes[0].reason, 'no_lights');
});
