import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import FLOOR from '../../card/src/rooms.json' with { type: 'json' };

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url));
test('approved floor plan is byte-identical to the recorded checksum', () => {
  assert.equal(createHash('sha256').update(rd('card/assets/floorplan.png')).digest('hex'), FLOOR.image.sha256);
  assert.match(rd('card/assets/floorplan.png.sha256').toString(), new RegExp(FLOOR.image.sha256));
});
test('PNG dimensions match the SVG viewBox', () => {
  const b = rd('card/assets/floorplan.png');
  assert.equal(b.readUInt32BE(16), FLOOR.image.width); assert.equal(b.readUInt32BE(20), FLOOR.image.height);
});
test('six regions exist, stay inside the image, and do not overlap', () => {
  const ids = Object.keys(FLOOR.regions); assert.equal(ids.length, 6);
  const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  for (const id of ids) for (const [x, y] of FLOOR.regions[id]) assert.ok(x >= 0 && x <= FLOOR.image.width && y >= 0 && y <= FLOOR.image.height, id);
  for (let x = 0; x < FLOOR.image.width; x += 8) for (let y = 0; y < FLOOR.image.height; y += 8) {
    const hits = ids.filter((id) => inside([x, y], FLOOR.regions[id])); assert.ok(hits.length <= 1, `overlap at ${x},${y}: ${hits}`);
  }
});
test('theme compliance: card CSS uses theme variables only', () => {
  const css = rd('card/src/styles.ts').toString().replace(/\/\/.*$/gm, '');
  assert.ok(!/!important/.test(css), 'no !important');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no hardcoded hex colours in UI styles');
  assert.ok(!/rgba?\(/.test(css), 'no rgb() colours');
  assert.ok(!/border-radius:\s*[1-9]/.test(css), 'square corners');
  for (const v of ['--primary-color', '--ha-color-focus', '--divider-color', '--primary-text-color']) assert.ok(css.includes(v), v);
});
test('card source has no innerHTML, eval or remote URLs', () => {
  const src = rd('card/src/card.ts').toString().replace(/\/\/.*$/gm, '').replace('http://www.w3.org/2000/svg', '');
  assert.ok(!/innerHTML|eval\(|new Function|https?:\/\//.test(src));
});
