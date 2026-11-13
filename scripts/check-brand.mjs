import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { posix } from 'node:path';
const base = 'brand/civica/';
const acceptedPath = 'docs/accepted-assets.json';
const checksumPath = 'docs/SHA256SUMS.json';
const omittedPath = 'themes/civic-cobalt/muted/emblem-primary.webp';
const accepted = JSON.parse(readFileSync(base + acceptedPath, 'utf8'));
assert.equal(accepted.schemaVersion, 1);
assert.equal(accepted.brandName, 'civica');
assert.equal(accepted.brandVersion, 'revised-2026-11-13');
assert.equal(accepted.sourceArchive, 'civica_brand_assets_revised.zip');
assert.equal(accepted.sourceArchiveSha256, '0d1a44c3526ccaafa773e1d7314d0d3df6e2e77065be7c3f9c2e1de36dc14d2a');
assert.equal(accepted.sourcePackManifest, checksumPath);
const suppliedChecksums = JSON.parse(readFileSync(base + checksumPath, 'utf8'));
const manifest = new Map();
function safePath(file) {
  assert.ok(!posix.isAbsolute(file) && posix.normalize(file) === file && !file.startsWith('../') && !file.includes('\\'), `Unsafe asset path: ${file}`);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let imageCount = 0;
for (const record of accepted.files) {
  const file = record.path;
  safePath(file);
  assert.ok(!manifest.has(file), `Duplicate accepted path: ${file}`);
  assert.match(record.sha256, /^[a-f\d]{64}$/);
  const bytes = readFileSync(base + file);
  assert.equal(bytes.length, record.bytes, `Asset length changed: ${file}`);
  assert.ok(bytes.length > 0, `Empty asset: ${file}`);
  assert.equal(hash(bytes), record.sha256, `Supplied artwork changed: ${file}`);
  // The only corrected source checksum is the supplied manifest's stale self-hash.
  if (file !== checksumPath) assert.equal(record.sha256, suppliedChecksums[file], `Source checksum differs: ${file}`);
  manifest.set(file, record.sha256);
  if (/\.(svg|png|webp|ico)$/.test(file)) {
    imageCount++;
    assert.ok(record.image?.width > 0 && record.image?.height > 0, `Missing decoded-image evidence: ${file}`);
    assert.equal(record.image.format, posix.extname(file).slice(1));
    if (file.endsWith('.svg')) {
      const svg = bytes.toString('utf8');
      assert.match(svg, /<svg\b[^>]*\bviewBox=/);
      assert.ok(!/<(?:script|foreignObject|image|use|iframe)\b|\bon\w+\s*=|\bhref\s*=|<!DOCTYPE|<!ENTITY/i.test(svg), `Active or external SVG content: ${file}`);
      assert.ok(!/civica\.uk|gov\.uk/i.test(svg), `Superseded or official identity: ${file}`);
    } else if (file.endsWith('.png')) {
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Invalid PNG signature: ${file}`);
      assert.equal(bytes.readUInt32BE(16), record.image.width, `PNG width differs: ${file}`);
      assert.equal(bytes.readUInt32BE(20), record.image.height, `PNG height differs: ${file}`);
    } else if (file.endsWith('.webp')) {
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid WebP container: ${file}`);
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WebP signature: ${file}`);
      assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `Truncated WebP: ${file}`);
    } else {
      assert.equal(bytes.subarray(0, 4).toString('hex'), '00000100', `Invalid icon signature: ${file}`);
      assert.ok(bytes.readUInt16LE(4) > 0, `Empty icon: ${file}`);
    }
  }
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    assert.ok(!e.isSymbolicLink(), `Unexpected symbolic link: ${dir}/${e.name}`);
    return e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`];
  });
}
assert.deepEqual(walk(base.slice(0, -1)).map(f => f.slice(base.length)).sort(), [...manifest.keys(), acceptedPath].sort(), 'Active assets differ from the accepted revised inventory');
assert.equal(manifest.size, 224);
assert.equal(imageCount, 218);
assert.deepEqual(accepted.counts, { sourceFiles: 225, acceptedSuppliedFiles: 224, acceptedImages: 218, excludedFiles: 1, localManifests: 1, activeFiles: 225, paletteFamilies: 10, paletteVariants: 20 });
assert.equal(accepted.exclusions.length, 1);
assert.equal(accepted.exclusions[0].path, omittedPath);
assert.equal(accepted.exclusions[0].bytes, 0);
assert.equal(accepted.exclusions[0].sha256, hash(Buffer.alloc(0)));
assert.equal(suppliedChecksums[omittedPath], hash(Buffer.alloc(0)));
assert.ok(!existsSync(base + omittedPath), 'Malformed source asset must not be installed');
for (const file of Object.keys(suppliedChecksums)) safePath(file);
assert.deepEqual(Object.keys(suppliedChecksums).sort(), [...manifest.keys(), omittedPath].sort(), 'Supplied checksum inventory differs');
const selfCorrection = accepted.metadataCorrections.find(r => r.path === checksumPath && r.field === checksumPath);
assert.equal(selfCorrection?.suppliedValue, suppliedChecksums[checksumPath]);
assert.equal(selfCorrection?.verifiedValue, manifest.get(checksumPath));
assert.notEqual(selfCorrection.suppliedValue, selfCorrection.verifiedValue);
const suppliedVerification = JSON.parse(readFileSync(base + 'docs/verification.json', 'utf8'));
for (const field of ['theme_files', 'zip_entries']) {
  const correction = accepted.metadataCorrections.find(r => r.path === 'docs/verification.json' && r.field === field);
  assert.equal(correction?.suppliedValue, suppliedVerification[field]);
  assert.equal(correction?.verifiedValue, field === 'theme_files' ? 167 : 225);
}

const canonical = JSON.parse(readFileSync('design-system/palettes.json', 'utf8'));
const supplied = JSON.parse(readFileSync(base + 'docs/brand-tokens.json', 'utf8'));
assert.deepEqual(Object.keys(supplied).sort(), canonical.palettes.map(p => p.id).sort(), 'Brand palette inventory differs');
for (const palette of canonical.palettes) {
  assert.equal(supplied[palette.id].name, palette.name, `Palette name differs: ${palette.id}`);
  for (const tone of canonical.tones) {
    for (const role of ['primary', 'canvas']) assert.equal(supplied[palette.id][tone][role], palette[tone][role].hex, `Supplied ${palette.id} ${tone} ${role} differs from requested palette`);
    for (const stem of ['lockup-on-primary', 'lockup-on-canvas', 'app-icon', 'emblem-primary']) {
      for (const extension of ['svg', 'png']) assert.ok(manifest.has(`themes/${palette.id}/${tone}/${stem}.${extension}`), `Missing ${palette.id} ${tone} ${stem}.${extension}`);
    }
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
// Explicit post-build check: the normal check also runs before build.mjs
// replaces ui/dist/brand, so it must not require generated files to be fresh.
if (process.argv.includes('--check-built')) {
  function copies(directory, expected, exact = false) {
    assert.ok(existsSync(directory), `Missing generated output: ${directory}`);
    for (const [file, digest] of expected) {
      assert.equal(hash(readFileSync(`${directory}/${file}`)), digest, `Built artwork differs: ${directory}/${file}`);
    }
    if (exact) {
      assert.deepEqual(walk(directory).map(f => f.slice(directory.length + 1)).sort(), [...expected.keys()].sort(), `Stale or missing built assets: ${directory}`);
    }
  }
  const runtime = new Map([...manifest].filter(([file]) => /^(core|icons|themes)\//.test(file)));
  copies('ui/dist/brand', runtime, true);
  const docs = JSON.parse(readFileSync('docs/source/reference/brand-assets.json', 'utf8'));
  assert.equal(docs.acceptedPackManifestSha256, hash(readFileSync(base + acceptedPath)), 'Documentation mapping uses a different accepted package');
  const published = new Map(docs.assets.map(record => {
    assert.equal(record.sourcePath.startsWith(base), true, `Unexpected documentation source: ${record.sourcePath}`);
    const sourcePath = record.sourcePath.slice(base.length);
    safePath(record.publishedPath);
    assert.equal(record.sha256, manifest.get(sourcePath), `Documentation mapping differs from supplied artwork: ${sourcePath}`);
    return [record.publishedPath, record.sha256];
  }));
  copies('docs/build', published);
  copies('docs/build/images/themes', new Map([...published].filter(([file]) => file.startsWith('images/themes/')).map(([file, digest]) => [file.slice('images/themes/'.length), digest])), true);
  assert.equal(hash(readFileSync('docs/build/reference/brand-assets.json')), hash(readFileSync('docs/source/reference/brand-assets.json')), 'Built documentation provenance is stale');
  console.log(`Verified ${runtime.size} built companion assets and ${published.size} built documentation copies against the accepted package.`);
}
console.log(`Verified ${manifest.size} accepted revised source files, ${imageCount} decoded-image records, 20 palette variants and available docs output. One empty WebP is excluded; source metadata corrections are recorded.`);
