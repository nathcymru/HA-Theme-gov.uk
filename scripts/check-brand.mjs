import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { posix } from 'node:path';
const base = 'brand/civica/';
const checksumPath = 'docs/SHA256SUMS.txt';
const manifest = new Map();
for (const line of readFileSync(base + checksumPath, 'utf8').trim().split(/\r?\n/)) {
  const match = /^([a-f\d]{64}) {2}(.+)$/.exec(line);
  assert.ok(match, 'Invalid supplied SHA256SUMS entry');
  const [, hash, file] = match;
  assert.ok(!posix.isAbsolute(file) && posix.normalize(file) === file && !file.startsWith('../') && !file.includes('\\'), `Unsafe asset path: ${file}`);
  assert.ok(!manifest.has(file), `Duplicate checksum path: ${file}`);
  manifest.set(file, hash);
}
for (const [file, hash] of manifest) {
  assert.equal(createHash('sha256').update(readFileSync(base + file)).digest('hex'), hash, `Supplied artwork changed: ${file}`);
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    assert.ok(!e.isSymbolicLink(), `Unexpected symbolic link: ${dir}/${e.name}`);
    return e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`];
  });
}
assert.deepEqual(walk(base.slice(0, -1)).map(f => f.slice(base.length)).sort(), [...manifest.keys(), checksumPath].sort(), 'Asset inventory differs from v3.2 archive');

const canonical = JSON.parse(readFileSync('design-system/palettes.json', 'utf8'));
const supplied = JSON.parse(readFileSync(base + 'docs/civica-colour-tokens.json', 'utf8'));
assert.deepEqual(Object.keys(supplied).sort(), canonical.palettes.map(p => p.id).sort(), 'Brand palette inventory differs');
for (const palette of canonical.palettes) {
  assert.equal(supplied[palette.id].name, palette.name, `Palette name differs: ${palette.id}`);
  for (const tone of canonical.tones) {
    for (const role of ['primary', 'canvas']) assert.equal(supplied[palette.id][tone][role], palette[tone][role].hex, `Supplied ${palette.id} ${tone} ${role} differs from requested palette`);
    for (const asset of ['lockup-on-primary.svg', 'lockup-on-canvas.svg', 'app-icon.svg', 'app-icon.png']) assert.ok(manifest.has(`themes/${palette.id}/${tone}/${asset}`), `Missing ${palette.id} ${tone} ${asset}`);
  }
}
if (existsSync('docs/build')) {
  const files = walk('docs/build');
  assert.ok(!files.some(f => /(?:transport|govuk-logo|govuk-crown|govuk-crest)/i.test(f)), 'Official brand asset in docs output');
  for (const file of files.filter(f => /\.html$/.test(f))) {
    const html = readFileSync(file, 'utf8');
    assert.ok(!/govuk-header__logotype|govuk-footer__copyright-logo|<title>[^<]*GOV\.UK|<svg[^>]+govuk-logo/i.test(html), `Official identity in ${file}`);
  }
}
console.log(`Verified ${manifest.size} supplied v3.2 asset hashes, 20 palette variants and available docs output.`);
