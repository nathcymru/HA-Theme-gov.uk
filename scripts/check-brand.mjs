import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = 'brand/civica/';
const manifest = JSON.parse(readFileSync(`${base}docs/SHA256-MANIFEST.json`, 'utf8'));
for (const [file, hash] of Object.entries(manifest)) {
  assert.equal(createHash('sha256').update(readFileSync(base + file)).digest('hex'), hash, `Supplied artwork changed: ${file}`);
}
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
if (existsSync('docs/build')) {
  const files = walk('docs/build');
  assert.ok(!files.some(f => /(?:transport|govuk-logo|govuk-crown|govuk-crest)/i.test(f)), 'Official brand asset in docs output');
  for (const file of files.filter(f => /\.html$/.test(f))) {
    const html = readFileSync(file, 'utf8');
    assert.ok(!/govuk-header__logotype|govuk-footer__copyright-logo|<title>[^<]*GOV\.UK|<svg[^>]+govuk-logo/i.test(html), `Official identity in ${file}`);
  }
}
console.log(`Verified ${Object.keys(manifest).length} supplied asset hashes and available docs output.`);
