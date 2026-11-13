import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSource, sha256, isNamingSource } from '../scripts/check-naming.mjs';
const empty = () => ({ historical_files: [], historical_values: [], historical_lines: [] });
test('current project names and official GOV.UK references are distinct from retired identity', () => {
  assert.deepEqual(inspectSource('README.md', 'civica uses the GOV.UK Design System at https://design-system.service.gov.uk/. Legacy govuk.yaml remains compatible.', empty()), []);
  assert.equal(inspectSource('README.md', 'Get https://nathcymru.github.io/HA-Theme-gov.uk/', empty()).length, 1);
  assert.equal(inspectSource('README.md', 'Install civica-home-assistant.zip', empty()).length, 1);
});
test('historical values cannot exempt a current title or changed historical copy', () => {
  const old = 'Introduced civica.uk examples.';
  const policy = empty();
  policy.historical_values.push({ path: 'docs/source/example.html.md.erb', pointer: '/frontmatter/updates/0/description', sha256: sha256(old) });
  const page = title => `---\ntitle: ${title}\nupdates:\n- description: ${old}\n---\nCurrent civica content.\n`;
  assert.deepEqual(inspectSource('docs/source/example.html.md.erb', page('civica'), policy), []);
  assert.equal(inspectSource('docs/source/example.html.md.erb', page('civica.uk'), policy).length, 1);
  assert.equal(inspectSource('docs/source/example.html.md.erb', page('civica').replace(old, old + ' changed'), policy).length, 1);
});
test('immutable evidence and original creator lines require exact unchanged content', () => {
  const policy = empty();
  const evidence = '{"project":"civica.uk"}\n';
  policy.historical_files.push({ path: 'docs/data/earlier-review.json', sha256: sha256(evidence) });
  assert.deepEqual(inspectSource('docs/data/earlier-review.json', evidence, policy), []);
  assert.equal(inspectSource('docs/data/earlier-review.json', evidence + ' ', policy).length, 1);
  policy.historical_lines.push({ path: 'docs/source/images/original.svg', text: '<!-- Original civica.uk artwork. -->' });
  assert.deepEqual(inspectSource('docs/source/images/original.svg', '<!-- Original civica.uk artwork. -->\n<svg/>', policy), []);
  assert.equal(inspectSource('docs/source/images/original.svg', '<!-- Original civica.uk artwork. -->\n<text>civica.uk</text>', policy).length, 1);
});
test('current source is checked while fixtures and generated output have separate verification', () => {
  for (const path of ['docs/source/index.html.erb', 'ui/src/civica-ui.ts', '.github/workflows/validate.yml', 'docs/data/brand-guidance-inventory.json']) assert.ok(isNamingSource(path), path);
  for (const path of ['tests/naming.browser.spec.mjs', 'test/naming.test.mjs', 'docs/build/index.html', 'dist/civica.zip', 'docs/data/naming-inventory.json']) assert.equal(isNamingSource(path), false, path);
});
