import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_COLOUR_SPEC as spec, chartColour, chartSeriesStyle, chartContrast } from '../design-system/chart-colours.mjs';

const contexts = ['light', 'dark'].flatMap(mode => ['vivid', 'muted'].map(tone => ({ mode, tone })));
const examples = spec.exampleKeys.map(({ key }) => key);

test('opaque chart colours meet surface contrast in both tones and modes, including all semantic anchors', () => {
  const identities = [...Object.keys(spec.roles), ...examples, ...Array.from({ length: 15 }, (_, i) => `series-${i + 10}`), ...Array.from({ length: 300 }, (_, i) => `sensor.additional_energy_${i}`)];
  for (const context of contexts) for (const key of identities) {
    const colour = chartColour(key, context);
    assert.match(colour, /^#[0-9A-F]{6}$/);
    for (const surface of spec.surfaces[context.mode]) {
      assert.ok(chartContrast(colour, surface) >= spec.minimumSurfaceContrast, `${key} ${JSON.stringify(context)} ${colour}/${surface}`);
    }
  }
});

test('the twenty-four named examples have distinct colours and the calculated range continues beyond twenty', () => {
  assert.equal(examples.length, 24);
  for (const context of contexts) {
    assert.equal(new Set(examples.map(key => chartColour(key, context))).size, 24);
    const themeSlots = [...Object.keys(spec.roles), ...Array.from({ length: 15 }, (_, i) => `series-${i + 10}`)];
    assert.equal(new Set(themeSlots.map(key => chartColour(key, context))).size, 24);
    const longer = Array.from({ length: 80 }, (_, i) => chartColour(`sensor.calculated_series_${i}`, context));
    assert.equal(new Set(longer).size, 80);
    assert.notEqual(longer[0], longer[20]);
  }
});

test('multiple meters within a semantic family retain deterministic opaque variations and contrast', () => {
  for (const context of contexts) for (const role of ['grid-consumption', 'grid-return', 'solar', 'gas', 'water', 'battery-in', 'battery-out']) {
    const one = chartSeriesStyle(`${role}:meter-one`, context);
    const two = chartSeriesStyle(`${role}:meter-two`, context);
    assert.notEqual(one.color, two.color, `${role} ${JSON.stringify(context)}`);
    assert.deepEqual(chartSeriesStyle(`${role}:meter-one`, context), one);
    for (const surface of spec.surfaces[context.mode]) {
      assert.ok(chartContrast(one.color, surface) >= 3);
      assert.ok(chartContrast(two.color, surface) >= 3);
    }
  }
});

test('identity survives ordering, filtering, extension and equivalent Unicode without a brand input', () => {
  for (const context of contexts) {
    const original = new Map(examples.map(key => [key, chartSeriesStyle(key, context)]));
    for (const key of [...examples].reverse().concat('sensor.newly_added_energy')) {
      if (original.has(key)) assert.deepEqual(chartSeriesStyle(key, context), original.get(key));
    }
    for (const key of examples.filter((_, i) => i % 2)) assert.deepEqual(chartSeriesStyle(key, context), original.get(key));
  }
  assert.equal(chartColour(' sensor.caf\u00e9 '), chartColour('sensor.cafe\u0301'));
  for (const key of ['constructor', '__proto__', 'toString', 'constructor:meter']) assert.match(chartColour(key), /^#[0-9A-F]{6}$/);
  const beforeEviction = chartSeriesStyle(examples[0]);
  for (let i = 0; i < 2200; i++) chartColour(`sensor.cache_eviction_${i}`);
  assert.deepEqual(chartSeriesStyle(examples[0]), beforeEviction);
});

test('vivid and muted change opaque colour while preserving identity pattern and symbol', () => {
  for (const mode of ['light', 'dark']) for (const key of [...Object.keys(spec.roles), ...examples]) {
    const vivid = chartSeriesStyle(key, { mode, tone: 'vivid' });
    const muted = chartSeriesStyle(key, { mode, tone: 'muted' });
    assert.notEqual(vivid.color, muted.color, key);
    assert.deepEqual({ ...vivid, color: '' }, { ...muted, color: '' });
  }
});

test('semantic light vivid anchors remain stable and patterns are usable without mutating shared state', () => {
  for (const [key, role] of Object.entries(spec.roles)) assert.equal(chartColour(key), role.anchor);
  const styles = examples.map(key => chartSeriesStyle(key));
  assert.ok(new Set(styles.map(style => style.pattern)).size >= 5);
  assert.ok(new Set(styles.map(style => style.symbol)).size >= 5);
  // These reference pairs are visually close; exact hex uniqueness alone is
  // inadequate. Their secondary channels must supply a different identity.
  for (const [one, two] of [['sensor.coffee_machine_energy', 'sensor.workshop_energy'], ['sensor.washing_machine_energy', 'sensor.tumble_dryer_energy']]) {
    const cues = key => { const { pattern, lineDash, symbol } = chartSeriesStyle(key); return { pattern, lineDash, symbol }; };
    assert.notDeepEqual(cues(one), cues(two));
  }
  for (const style of styles) {
    assert.ok(spec.patterns.includes(style.pattern));
    assert.ok(style.lineDash.every(value => Number.isFinite(value) && value > 0));
    assert.ok(Number.isInteger(style.index) && style.index >= 0);
  }
  const original = chartSeriesStyle('gas');
  const modified = chartSeriesStyle('gas'); modified.lineDash.push(999);
  assert.deepEqual(chartSeriesStyle('gas'), original);
  assert.throws(() => { spec.roles.solar.anchor = '#FFFFFF'; }, TypeError);
});

test('invalid identities and tone/mode choices fail explicitly', () => {
  for (const key of ['', ' ', null, 123]) assert.throws(() => chartColour(key), TypeError);
  assert.throws(() => chartColour('grid-consumption', { tone: 'transparent' }), TypeError);
  assert.throws(() => chartColour('grid-consumption', { mode: 'auto' }), TypeError);
});
