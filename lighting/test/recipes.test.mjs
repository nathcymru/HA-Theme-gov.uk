import test from 'node:test';
import assert from 'node:assert/strict';
import { load, validate, catalogue, gradient } from '../scripts/recipes-lib.mjs';

const doc = load();
test('canonical file validates', () => assert.deepEqual(validate(doc), []));
test('4 whites, 7 colours, 5 scenes, unique ids', () => {
  const c = catalogue(doc);
  assert.equal(c.filter((r) => r.category === 'white').length, 4);
  assert.equal(c.filter((r) => r.category === 'color').length, 7);
  assert.equal(c.filter((r) => r.category === 'scene').length, 5);
  assert.equal(new Set(c.map((r) => r.id)).size, 16);
});
test('scene preview gradients match the brief', () => {
  const g = Object.fromEntries(catalogue(doc).filter((r) => r.category === 'scene').map((r) => [r.id, r.previewCss]));
  assert.equal(g.rugby, 'linear-gradient(90deg, #D30A24 0%, #00FF00 50%, #FFFFFF 100%)');
  assert.equal(g.christmas, 'linear-gradient(90deg, #FF0000 0%, #008000 25%, #FFD700 50%, #C0C0C0 75%, #FFFFFF 100%)');
  assert.equal(g.emergency, gradient([[0, '#FF0000'], [100, '#0000FF']]));
});
test('brand overrides are per-brand', () => {
  const o = catalogue(doc).find((r) => r.id === 'orange');
  assert.deepEqual(o.hue, [255, 94, 0]); assert.deepEqual(o.innr, [255, 80, 0]);
});
test('Christmas cosy white is Kelvin, not hex', () => {
  const x = catalogue(doc).find((r) => r.id === 'christmas').palette.at(-1);
  assert.equal(x.kelvin, 2700); assert.equal(x.hue, undefined);
});
test('emergency is opt-in with a runtime cap', () => {
  const e = catalogue(doc).find((r) => r.id === 'emergency');
  assert.ok(e.safety.disabledByDefault && e.safety.requiresOptIn && e.safety.maxRuntimeS > 0);
});
test('validator rejects bad input', () => {
  const bad = structuredClone(doc); bad.colors[0].hue = [300, 0, 0]; bad.scenes[4].safety.maxRuntimeS = 0;
  const e = validate(bad); assert.ok(e.some((m) => m.includes('invalid RGB'))); assert.ok(e.some((m) => m.includes('safety')));
});
