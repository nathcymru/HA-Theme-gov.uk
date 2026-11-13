import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { STATUS_LABELS, RoadmapError, parsePublicFields, toPlainText, buildSnapshot, validateSnapshot, fetchRoadmap, writeSnapshotAtomic } from '../scripts/roadmap.mjs';

const now = new Date('2026-12-10T12:00:00Z');
const benefit = 'Find the room you need from a clear list. Keep its everyday controls together.';
const body = (title = 'Clearer room navigation', summary = benefit, notes = 'Private developer material must never appear in the roadmap.') => `### Public title\n\n${title}\n\n### User benefit\n\n${summary}\n\n### Scope\n\nTheme feature only\n\n### Developer Notes\n\n${notes}`;
const issue = (number = 1, overrides = {}) => ({ number, title: 'UNTRUSTED issue title', body: body(), labels: [{ name: STATUS_LABELS.inWorks }, { name: 'tag: Navigation' }], state: 'open', state_reason: null, closed_at: null, user: { login: 'do-not-publish' }, html_url: 'https://example.invalid/private', ...overrides });
const done = (number, closed_at, overrides = {}) => issue(number, { state: 'closed', state_reason: 'completed', closed_at, labels: [STATUS_LABELS.completed, 'tag: Controls'], body: body(`Clearer controls ${number}`), ...overrides });
const empty = () => ({ schemaVersion: 2, scope: 'theme-features', accepted: [], inWorks: [], delivered: [] });
const agreed = (number = 1, overrides = {}) => issue(number, { labels: [STATUS_LABELS.accepted, 'tag: Voice & BSL', 'tag: Easy Controls'], ...overrides });
const withMedia = (value = '', formBody = body()) => formBody.replace('### Developer Notes', `### BSL / Audio Video Link\n\n${value}\n\n### Developer Notes`);
const response = (data, link = null, status = 200) => new Response(JSON.stringify(data), { status, headers: link ? { link } : {} });
const pageLink = (url, page) => { const next = new URL(url); next.searchParams.set('page', String(page)); return `<${next}>; rel="next"`; };

// The maintained form itself is part of the privacy boundary, not just a fixture.
test('form has exactly the three required public fields, optional blank media and Developer Notes last, without publishing labels', async () => {
  const form = YAML.parse(await readFile('.github/ISSUE_TEMPLATE/roadmap_item.yml', 'utf8'));
  assert.equal(form.labels, undefined);
  const fields = form.body.filter(x => x.type !== 'markdown');
  assert.deepEqual(fields.map(x => x.attributes.label), ['Public title', 'User benefit', 'Scope', 'BSL / Audio Video Link', 'Developer Notes']);
  assert.deepEqual(fields.map(x => x.validations.required), [true, true, true, false, false]);
  assert.deepEqual(fields[2].attributes.options, ['Theme feature only']);
  assert.equal(form.body.at(-1).id, 'developer-notes');
  assert.equal(fields[3].id, 'bsl-audio-video-link');
  assert.match(fields[3].attributes.description, /Leave this blank/);
});

test('parser exposes only form title and benefit, stopping before developer text even when it imitates public fields', () => {
  const notes = '<script>alert("secret")</script>\n### Public title\nLeaked content\n@maintainer #777 deadbeef1';
  assert.deepEqual(parsePublicFields(body(undefined, undefined, notes), 7), { title: 'Clearer room navigation', summary: benefit });
  const result = buildSnapshot([issue(7, { body: body(undefined, undefined, notes) })], { now });
  assert.deepEqual(result, { ...empty(), inWorks: [{ categories: ['Navigation'], title: 'Clearer room navigation', summary: benefit }] });
  assert.ok(!JSON.stringify(result).match(/secret|Leaked|maintainer|777|deadbeef1|UNTRUSTED|do-not-publish|html_url/));
});

test('normal Markdown becomes plain text; references, usernames and mixed hexadecimal hashes are removed', () => {
  assert.equal(toPlainText('**Choose** [clearer colours](https://example.com/path) with `large labels`. @reader owner/repo#123', 'summary'), 'Choose clearer colours with large labels.');
  assert.equal(toPlainText('Read **0.5 kWh** across 12 rooms on 20261112. #456 ab12cd34', 'summary'), 'Read 0.5 kWh across 12 rooms on 20261112.');
  assert.equal(toPlainText('Use _clear_ labels &amp; **readable** values.', 'summary'), 'Use clear labels & readable values.');
  assert.equal(toPlainText('- Find the room you need.\n- Read its reported temperature.', 'summary'), 'Find the room you need. Read its reported temperature.');
  assert.equal(toPlainText('Try clearer labels in every room. <https://example.com> person@example.org', 'summary'), 'Try clearer labels in every room.');
});

test('unsafe, empty, malformed and excessive public content fails without echoing the content', () => {
  const bad = ['<script>SECRET</script>', '&lt;script&gt;SECRET', '[SECRET](javascript:alert)', '[SECRET](data:text/html,test)', 'SECRET\u202e concealed text', '```\nSECRET\n```', '[SECRET](https://example.com/path(nested))', '`SECRET', 'SECRET '.repeat(1000), '@secret #123 deadbeef123'];
  for (const value of bad) assert.throws(() => parsePublicFields(body('Clearer navigation', value), 42), error => error instanceof RoadmapError && /Issue #42:/.test(error.message) && !/SECRET|secret|deadbeef123/.test(error.message));
});

test('public form headings, scope and the developer boundary are required and cannot be duplicated or reordered', () => {
  for (const malformed of [body().replace('### Developer Notes', '## Developer Notes'), body().replace('### User benefit', '### Extra field'), body().replace('Theme feature only', 'Documentation'), 'Preamble\n' + body(), body().replace('### Scope', '### Public title\nExtra\n\n### Scope'), body().replace(benefit, '### Developer Notes\nA premature boundary'), body().replace('### Public title', '### User benefit')]) assert.throws(() => parsePublicFields(malformed, 9), RoadmapError);
  assert.deepEqual(parsePublicFields(body().replaceAll('\n', '\r\n').replace('### Developer Notes', ' ### developer notes ###')), { title: 'Clearer room navigation', summary: benefit });
});

test('benefit has one or two sentences, with exact limits and numbers preserved', () => {
  assert.equal(toPlainText('Read 0.5 kWh on a clear energy chart.', 'summary'), 'Read 0.5 kWh on a clear energy chart.');
  assert.equal(toPlainText(benefit, 'summary'), benefit);
  assert.throws(() => toPlainText('Choose a room. Read its temperature. Change its lighting.', 'summary'), /1 or 2 sentences/);
  assert.throws(() => toPlainText('Choose a room. read its temperature. change its lighting.', 'summary'), /1 or 2 sentences/);
  assert.throws(() => toPlainText('Too short.', 'summary'), /length limit/);
  assert.throws(() => toPlainText('A'.repeat(401), 'summary'), /length limit/);
  assert.throws(() => toPlainText('Title'.repeat(25), 'title'), /length limit/);
  assert.throws(() => toPlainText('    ', 'title'), /meaningful text/);
});

test('one to three readable categories are required', () => {
  for (const labels of [[STATUS_LABELS.inWorks], [STATUS_LABELS.inWorks, 'tag: Charts', 'tag: Controls', 'tag: Colours', 'tag: Navigation'], [STATUS_LABELS.inWorks, 'tag:'], [STATUS_LABELS.inWorks, 'tag: <script>'], [STATUS_LABELS.inWorks, 'tag: @reader'], [STATUS_LABELS.inWorks, 'tag: 123'], [STATUS_LABELS.inWorks, 'tag: Too  many spaces']]) assert.throws(() => buildSnapshot([issue(13, { labels })], { now }), /Issue #13:/);
  assert.deepEqual(buildSnapshot([issue(13, { labels: [STATUS_LABELS.inWorks, 'tag: Charts & tables'] })], { now }).inWorks[0].categories, ['Charts & tables']);
});

test('PRs are excluded before body, labels or delivery state are interpreted', () => {
  assert.deepEqual(buildSnapshot([{ pull_request: { url: 'ignored' }, body: '<script>' }], { now }), empty());
});

test('conflicting, unreviewed and stale roadmap labels fail instead of inventing deliveries', () => {
  const bad = [issue(21, { labels: [STATUS_LABELS.inWorks, STATUS_LABELS.completed, 'tag: Controls'] }), issue(21, { labels: ['tag: Controls'] }), issue(21, { state: 'closed', state_reason: 'completed', closed_at: '2026-11-20T00:00:00Z' }), done(21, '2026-11-20T00:00:00Z', { state: 'open' }), done(21, '2026-11-20T00:00:00Z', { state_reason: 'not_planned' }), done(21, '2026-11-20T00:00:00Z', { state_reason: null }), done(21, null), issue(21, { state_reason: 'completed' })];
  for (const record of bad) assert.throws(() => buildSnapshot([record], { now }), error => error instanceof RoadmapError && /^Issue #21:/.test(error.message));
});

test('completion dates are real, non-future and grouped by UTC rather than local offset', () => {
  const result = buildSnapshot([done(1, '2026-12-01T00:30:00+01:00')], { now });
  assert.equal(result.delivered[0].months[0].month, '2026-11');
  assert.equal(result.delivered[0].months[0].label, 'November');
  for (const date of ['2026-11-31T12:00:00Z', '2026-02-29T12:00:00Z', '2026-11-12T24:00:00Z', '2026-11-12T12:00:00+99:00', '2027-01-01T00:00:00Z', '2026-11-01', 'not a date']) assert.throws(() => buildSnapshot([done(7, date)], { now }), /Issue #7:/);
  assert.equal(buildSnapshot([done(7, '2024-02-29T12:00:00Z')], { now }).delivered[0].year, 2024);
});

test('in-works items sort by category/title; deliveries sort by UTC year, month and completion instant', () => {
  const input = [done(1, '2025-12-31T23:59:00Z'), done(2, '2026-10-01T00:00:00Z'), done(3, '2026-11-01T00:00:00Z'), done(4, '2026-11-20T00:00:00Z'), issue(5, { body: body('Zoned controls'), labels: [STATUS_LABELS.inWorks, 'tag: Controls'] }), issue(6, { body: body('Accessible charts'), labels: [STATUS_LABELS.inWorks, 'tag: Charts'] }), issue(7, { body: body('Clearer controls'), labels: [STATUS_LABELS.inWorks, 'tag: Controls'] })];
  const result = buildSnapshot(input, { now });
  assert.deepEqual(result.inWorks.map(x => x.title), ['Accessible charts', 'Clearer controls', 'Zoned controls']);
  assert.deepEqual(result.delivered.map(x => x.year), [2026, 2025]);
  assert.deepEqual(result.delivered[0].months.map(x => x.month), ['2026-11', '2026-10']);
  assert.deepEqual(result.delivered[0].months[0].items.map(x => x.title), ['Clearer controls 4', 'Clearer controls 3']);
  assert.deepEqual(buildSnapshot([...input].reverse(), { now }), result);
});

test('duplicate source issues and duplicate public names fail safely', () => {
  assert.throws(() => buildSnapshot([issue(1), issue(1)], { now }), /Issue #1:.*repeated/);
  assert.throws(() => buildSnapshot([issue(1), issue(2)], { now }), /Issue #2:.*duplicate/);
});

test('offline validation rejects extra metadata, unsafe text, empty date groups and malformed ordering', () => {
  const good = buildSnapshot([issue()], { now });
  assert.equal(validateSnapshot(good), good);
  const bad = [{ ...good, authors: ['person'] }, { ...good, scope: 'all-project-work' }, { ...good, inWorks: [{ ...good.inWorks[0], url: 'https://example.com' }] }, { ...good, inWorks: [{ ...good.inWorks[0], summary: '<script>Unsafe words</script>' }] }, { ...empty(), delivered: [{ year: 2026, months: [] }] }, { ...empty(), delivered: [{ year: 2026, months: [{ month: '2026-11', label: 'October', items: good.inWorks }] }] }, { ...empty(), delivered: [{ year: 2026, months: [{ month: '2025-11', label: 'November', items: good.inWorks }] }] }];
  for (const snapshot of bad) assert.throws(() => validateSnapshot(snapshot), RoadmapError);
  assert.throws(() => validateSnapshot({ ...empty(), inWorks: [good.inWorks[0], { ...good.inWorks[0], categories: ['Charts'] }] }), /sorted/);
  assert.throws(() => validateSnapshot(JSON.parse('{"schemaVersion":2,"scope":"theme-features","accepted":[],"inWorks":[],"delivered":[],"__proto__":{}}')), /fields/);
});

test('fetch queries each review label independently, follows every page and excludes PRs', async () => {
  const calls = [];
  const result = await fetchRoadmap({ repository: 'owner/repository', token: 'TOKEN-NOT-FOR-OUTPUT', now, fetchImpl: async (url, options) => {
    calls.push({ url, options }); const parsed = new URL(url), page = parsed.searchParams.get('page');
    assert.equal(parsed.searchParams.get('state'), 'all');
    assert.equal(parsed.searchParams.get('per_page'), '100');
    assert.equal(options.redirect, 'error');
    if (parsed.searchParams.get('labels') === STATUS_LABELS.accepted) return response([agreed(4, { body: body('Clearer voice navigation') })]);
    if (parsed.searchParams.get('labels') === STATUS_LABELS.inWorks) return page === '1' ? response([issue(1)], pageLink(url, 2)) : response([issue(2, { body: body('Readable room names') }), { pull_request: {} }]);
    return response([done(3, '2026-11-12T10:00:00Z')]);
  } });
  assert.equal(calls.length, 4);
  assert.equal(result.accepted.length, 1);
  assert.deepEqual([...new Set(calls.map(call => new URL(call.url).searchParams.get('labels')))], Object.values(STATUS_LABELS));
  assert.equal(result.inWorks.length, 2);
  assert.equal(result.delivered[0].months[0].items.length, 1);
  assert.ok(!JSON.stringify(result).includes('TOKEN'));
});

test('API, JSON and transport failures use safe diagnostics and do not reveal returned bodies or tokens', async () => {
  for (const fetchImpl of [async () => response({ message: 'SECRET-TOKEN body' }, null, 403), async () => new Response('SECRET-TOKEN malformed JSON'), async () => { throw new Error('SECRET-TOKEN raw request'); }, async () => response({ secret: 'SECRET-TOKEN' })]) await assert.rejects(fetchRoadmap({ repository: 'owner/repo', token: 'SECRET-TOKEN', now, fetchImpl }), error => error instanceof RoadmapError && !/SECRET-TOKEN|raw request|malformed JSON/.test(error.message));
  await assert.rejects(fetchRoadmap({ repository: '../repo', token: 'x' }), /GITHUB_REPOSITORY/);
  await assert.rejects(fetchRoadmap({ repository: 'owner/repo', token: '' }), /GH_TOKEN/);
});

test('pagination cannot send credentials to another host, change the query, skip pages or loop', async () => {
  for (const mutate of [url => url.replace('api.github.com', 'attacker.example'), url => url.replace('page=1', 'page=1'), url => url.replace('page=1', 'page=3'), url => url.replace('state=all', 'state=open').replace('page=1', 'page=2'), url => url.replace(/labels=[^&]+/, 'labels=other').replace('page=1', 'page=2')]) {
    let calls = 0;
    await assert.rejects(fetchRoadmap({ repository: 'owner/repo', token: 'secret', now, fetchImpl: async url => { calls++; return response([], `<${mutate(url)}>; rel="next"`); } }), /pagination/);
    assert.equal(calls, 1);
  }
});

test('atomic writer validates before replacing a good snapshot and leaves no partial files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-roadmap-'));
  try {
    const output = join(dir, 'roadmap.json'); await writeSnapshotAtomic(output, empty()); const before = await readFile(output, 'utf8');
    await assert.rejects(writeSnapshotAtomic(output, { ...empty(), secret: true }), /fields/);
    assert.equal(await readFile(output, 'utf8'), before);
    const changed = buildSnapshot([issue()], { now }); await writeSnapshotAtomic(output, changed);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), changed);
    assert.deepEqual(await readdir(dir), ['roadmap.json']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI validates current or isolated empty snapshots offline; fetch needs explicit credentials', async () => {
  validateSnapshot(JSON.parse(await readFile('docs/data/roadmap.json', 'utf8')));
  assert.match(execFileSync(process.execPath, ['scripts/roadmap.mjs', '--check'], { encoding: 'utf8' }), /valid/);
  const result = spawnSync(process.execPath, ['scripts/roadmap.mjs', '--fetch'], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', GITHUB_REPOSITORY: 'owner/repo' } });
  assert.equal(result.status, 1); assert.match(result.stderr, /GH_TOKEN/);
  const dir = await mkdtemp(join(tmpdir(), 'civica-roadmap-cli-'));
  try { const file = join(dir, 'preview.json'); await writeFile(file, JSON.stringify(empty())); assert.match(execFileSync(process.execPath, ['scripts/roadmap.mjs', '--check', '--output', file], { encoding: 'utf8' }), /valid/); }
  finally { await rm(dir, { recursive: true, force: true }); }
});


test('real GitHub numeric repository links preserve opaque cursors on the configured repository route', async () => {
  const cursor = 'Y3Vyc29yOnYyOpLPAAABoYX4ItDPAAAAAWsrdkA=';
  const requested = [];
  const result = await fetchRoadmap({ repository: 'nathcymru/civica', token: 'secret', now, fetchImpl: async url => {
    const parsed = new URL(url); requested.push(parsed);
    assert.equal(parsed.pathname, '/repos/nathcymru/civica/issues');
    if (parsed.searchParams.get('labels') !== STATUS_LABELS.inWorks) return response([]);
    if (parsed.searchParams.get('page') === '1') {
      const next = new URL(url); next.pathname = '/repositories/1437953677/issues'; next.searchParams.set('page', '2'); next.searchParams.set('after', cursor);
      return response([issue(1)], `<${next.href}>; rel="next"`);
    }
    assert.equal(parsed.searchParams.get('after'), cursor);
    return response([issue(2, { body: body('Clearer device names') })]);
  } });
  assert.equal(requested.length, 4); assert.equal(result.inWorks.length, 2);
});

test('changed status labels and malformed next links fail before a partial snapshot can replace the old file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-roadmap-partial-'));
  const output = join(dir, 'roadmap.json'); await writeSnapshotAtomic(output, empty());
  try {
    const previous = await readFile(output, 'utf8'); let calls = 0;
    await assert.rejects((async () => {
      const snapshot = await fetchRoadmap({ repository: 'owner/repo', token: 'secret', now, fetchImpl: async url => {
        if (new URL(url).searchParams.get('labels') === STATUS_LABELS.accepted) return response([]);
        calls++; if (calls === 1) return response([issue(1)], pageLink(url, 2));
        return response([done(2, '2026-11-12T00:00:00Z')]);
      } });
      await writeSnapshotAtomic(output, snapshot);
    })(), /Issue #2:.*changed/);
    assert.equal(await readFile(output, 'utf8'), previous);
    await assert.rejects(fetchRoadmap({ repository: 'owner/repo', token: 'secret', now, fetchImpl: async () => response([], '<https://api.github.com/untrusted>; rel=next') }), /malformed pagination/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('accepted features remain agreed but not started until their sole status label changes', () => {
  const initial = agreed(41, { body: withMedia() });
  const accepted = buildSnapshot([initial], { now });
  assert.equal(accepted.accepted.length, 1); assert.equal(accepted.inWorks.length, 0); assert.equal(accepted.delivered.length, 0);
  assert.deepEqual(accepted.accepted[0], { categories: ['Easy Controls', 'Voice & BSL'], title: 'Clearer room navigation', summary: benefit });
  const started = buildSnapshot([{ ...initial, labels: [STATUS_LABELS.inWorks, 'tag: Voice & BSL', 'tag: Easy Controls'] }], { now });
  assert.equal(started.accepted.length, 0); assert.deepEqual(started.inWorks, accepted.accepted);
  const completed = buildSnapshot([{ ...initial, labels: [STATUS_LABELS.completed, 'tag: Voice & BSL', 'tag: Easy Controls'], state: 'closed', state_reason: 'completed', closed_at: '2026-11-13T00:01:00Z' }], { now });
  assert.equal(completed.accepted.length, 0); assert.equal(completed.inWorks.length, 0); assert.deepEqual(completed.delivered[0].months[0].items, accepted.accepted);
});

test('accepted state and label conflicts fail; reopened open features are allowed and duplicate closures are not deliveries', () => {
  for (const record of [agreed(42, { labels: [STATUS_LABELS.accepted, STATUS_LABELS.inWorks, 'tag: Controls'] }), agreed(42, { labels: [STATUS_LABELS.accepted, STATUS_LABELS.completed, 'tag: Controls'] }), agreed(42, { state: 'closed', state_reason: 'completed', closed_at: '2026-11-13T00:01:00Z' }), agreed(42, { closed_at: '2026-11-13T00:01:00Z' }), done(42, '2026-11-13T00:01:00Z', { state_reason: 'duplicate' })]) assert.throws(() => buildSnapshot([record], { now }), /Issue #42:/);
  assert.equal(buildSnapshot([agreed(42, { state_reason: 'reopened' })], { now }).accepted.length, 1);
});

test('category lists are stable, capped at three and reject duplicate spellings or malformed public arrays', () => {
  const labels = [STATUS_LABELS.accepted, 'tag: Voice & BSL', 'tag: Visual & Theme', 'tag: Easy Controls'];
  const result = buildSnapshot([agreed(51, { labels })], { now });
  assert.deepEqual(result.accepted[0].categories, ['Easy Controls', 'Visual & Theme', 'Voice & BSL']);
  assert.deepEqual(buildSnapshot([agreed(51, { labels: [...labels].reverse() })], { now }), result);
  for (const tags of [['tag: Voice & BSL', 'tag: Voice & BSL'], ['tag: Voice & BSL', 'tag: voice & bsl'], ['tag: A'], ['tag: ' + 'A'.repeat(41)]]) assert.throws(() => buildSnapshot([agreed(51, { labels: [STATUS_LABELS.accepted, ...tags] })], { now }), /Issue #51:/);
  for (const categories of [[], 'Controls', [null], ['Voice & BSL', 'Easy Controls'], ['Controls', 'controls'], ['One', 'Two', 'Three', 'Four']]) assert.throws(() => validateSnapshot({ ...result, accepted: [{ ...result.accepted[0], categories }] }), RoadmapError);
});

test('optional media can be absent, genuinely blank or GitHub empty, but any populated value fails without being copied', () => {
  const expected = parsePublicFields(body());
  for (const value of ['', '  \n  ', '_No response_']) assert.deepEqual(parsePublicFields(withMedia(value), 61), expected);
  for (const value of ['https://private.example/SECRET', '[Watch](https://private.example/SECRET)', '<iframe>SECRET</iframe>', 'None', 'No response', '\u200b']) assert.throws(() => parsePublicFields(withMedia(value), 61), error => error instanceof RoadmapError && /^Issue #61:/.test(error.message) && /must be blank/.test(error.message) && !/SECRET|private.example/.test(error.message));
  assert.throws(() => parsePublicFields(withMedia().replace('### Scope', '### BSL / Audio Video Link')), RoadmapError);
  const published = buildSnapshot([agreed(61, { body: withMedia('', body(undefined, undefined, '### BSL / Audio Video Link\nhttps://private.example/SECRET')) })], { now });
  assert.deepEqual(Object.keys(published.accepted[0]), ['categories', 'title', 'summary']);
  assert.ok(!JSON.stringify(published).includes('SECRET'));
});

test('schema 1 snapshots fail with a migration instruction while legacy three-field issue bodies still work', () => {
  assert.throws(() => validateSnapshot({ schemaVersion: 1, scope: 'theme-features', inWorks: [], delivered: [] }), /schema 1.*schema 2/);
  assert.equal(buildSnapshot([agreed(71, { body: body() })], { now }).schemaVersion, 2);
});
