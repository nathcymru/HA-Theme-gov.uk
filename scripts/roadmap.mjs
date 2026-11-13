// Structural publishing checks only. Maintainers review the wording and apply
// status/category labels; this parser does not certify plain English or delivery.
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const STATUS_LABELS = Object.freeze({ accepted: 'roadmap: accepted', inWorks: 'roadmap: in-works', completed: 'roadmap: completed' });
export const PUBLIC_LIMITS = Object.freeze({ title: [5, 120], summary: [20, 400], category: [2, 40] });
const FIELD_HEADINGS = ['Public title', 'User benefit', 'Scope'];
const MEDIA_HEADING = 'BSL / Audio Video Link';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULT_OUTPUT = 'docs/data/roadmap.json';
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class RoadmapError extends Error { constructor(message) { super(message); this.name = 'RoadmapError'; } }
function fail(message, issueNumber) {
  const prefix = Number.isSafeInteger(issueNumber) && issueNumber > 0 ? `Issue #${issueNumber}: ` : '';
  throw new RoadmapError(prefix + message);
}
function exactKeys(value, keys, description) {
  if (!plainObject(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`Invalid ${description} fields.`);
}
function lengthCheck(value, field, issueNumber) {
  const [min, max] = PUBLIC_LIMITS[field];
  if ([...value].length < min || [...value].length > max || !/\p{L}/u.test(value)) fail(`Public ${field} must contain meaningful text within its length limit.`, issueNumber);
}
function sentenceCheck(value, issueNumber) {
  // Keep decimals and ordinary initialisms intact. ICU alone treats a full stop
  // followed by lower-case text as a possible abbreviation, so also count clear
  // punctuation-separated clauses. This is a length gate, not language approval.
  const protectedText = value.replace(/\b(?:[A-Za-z]\.){2,}/g, match => match.replaceAll('.', '·')).replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|St)\./g, match => match.replace('.', '·'));
  const sentences = protectedText.split(/[.!?]+["'’”)]*\s+(?=[\p{L}\p{N}“"'(])/u).filter(part => /\p{L}/u.test(part));
  const icuCount = [...new Intl.Segmenter('en-GB', { granularity: 'sentence' }).segment(value)].filter(x => /\p{L}/u.test(x.segment)).length;
  if (Math.max(sentences.length, icuCount) < 1 || Math.max(sentences.length, icuCount) > 2) fail('User benefit must contain 1 or 2 sentences.', issueNumber);
}

export function toPlainText(value, field, issueNumber) {
  if (!['title', 'summary', 'category'].includes(field)) fail('Unknown public field.', issueNumber);
  if (typeof value !== 'string' || value.length > 5000) fail(`Invalid public ${field}.`, issueNumber);
  let text = value.normalize('NFC').replace(/\r\n?/g, '\n');
  if (/[\p{Cf}\p{Cs}]/u.test(text) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) fail(`Public ${field} contains unsupported control characters.`, issueNumber);
  if (/```|~~~|\b(?:javascript|vbscript|data)\s*:/i.test(text)) fail(`Public ${field} contains unsupported markup.`, issueNumber);
  // Plain Markdown links retain their label, never the URL. Nested/reference
  // links are rejected for editorial correction rather than guessed at.
  text = text.replace(/!?\[([^\[\]\n]*)\]\(([^\n()]*)\)/g, (_all, label, destination) => {
    if (!/^(?:https?:\/\/[^\s]+|#[A-Za-z0-9_-]+)(?:\s+"[^"\n]*")?$/.test(destination.trim())) fail(`Public ${field} contains an unsupported link.`, issueNumber);
    return label;
  });
  text = text.replace(/<https?:\/\/[^\s<>]+>/gi, '');
  // Reject raw/encoded HTML rather than relying on a downstream HTML renderer.
  text = text.replace(/&(?:amp|quot|apos|#39);/gi, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'" })[entity.toLowerCase()]);
  if (/[<>]|&(?:#\d+|#x[0-9a-f]+|lt|gt);/i.test(text)) fail(`Public ${field} must not contain HTML.`, issueNumber);
  text = text.replace(/\bhttps?:\/\/[^\s<>()]+/gi, url => url.match(/[.!?]+$/)?.[0] || '');
  text = text.replace(/\bwww\.[^\s]+/gi, '');
  text = text.replace(/\bmailto:[^\s]+/gi, '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '');
  text = text.replace(/@[A-Za-z0-9](?:[A-Za-z0-9-]*)(?:\/[A-Za-z0-9_-]+)?/g, '');
  text = text.replace(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+\b/g, '').replace(/#\d+\b/g, '');
  // Keep ordinary household numbers (including dates). Remove SHA-like mixed
  // hex tokens and full-length commit hashes, not every long decimal number.
  text = text.replace(/\b(?:[0-9a-f]{40}|(?=[0-9a-f]{7,40}\b)(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]+)\b/gi, '');
  text = text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*)/gm, '').replace(/#+/g, '');
  for (let i = 0; i < 3; i++) text = text.replace(/(\*\*|__|~~|\*|_|`)([^\n]+?)\1/g, '$2');
  if (/[\[\]`*_~\\]|(?:^|\s)\S+:\/\//u.test(text)) fail(`Public ${field} contains malformed or unsupported Markdown.`, issueNumber);
  text = text.replace(/\s+/g, ' ').replace(/\s+([,.;!?)])/g, '$1').replace(/\(\s+/g, '(').replace(/\(\)/g, '').trim();
  if (/^_?No response_?$/i.test(text)) fail(`Public ${field} is missing.`, issueNumber);
  lengthCheck(text, field, issueNumber);
  if (field === 'summary') sentenceCheck(text, issueNumber);
  return text;
}

export function parsePublicFields(body, issueNumber) {
  if (typeof body !== 'string') fail('The roadmap form body is missing.', issueNumber);
  const normal = body.replace(/\r\n?/g, '\n');
  // This generated textarea heading is a hard boundary, not submitted static
  // Markdown. Nothing after it is parsed, cleaned, copied, or logged.
  const boundary = /^\s{0,3}###[ \t]+Developer Notes[ \t]*(?:#+[ \t]*)?$/im.exec(normal);
  if (!boundary) fail('The Developer Notes boundary is missing.', issueNumber);
  const publicBody = normal.slice(0, boundary.index);
  if (publicBody.length > 15000) fail('The public form content is too long.', issueNumber);
  const headings = [...publicBody.matchAll(/^\s{0,3}###[ \t]+([^\n]+?)[ \t]*$/gm)];
  const expected = headings.length === 4 ? [...FIELD_HEADINGS, MEDIA_HEADING] : FIELD_HEADINGS;
  if (headings.length !== expected.length || headings.some((m, i) => m[1] !== expected[i]) || publicBody.slice(0, headings[0]?.index).trim()) fail('Use the public form fields in their original order, with the optional media field after Scope.', issueNumber);
  const values = headings.map((m, i) => publicBody.slice(m.index + m[0].length, headings[i + 1]?.index ?? publicBody.length).trim());
  if (values[2] !== 'Theme feature only') fail('Scope must be Theme feature only.', issueNumber);
  if (values.length === 4 && values[3] !== '' && values[3] !== '_No response_') fail('BSL / Audio Video Link must be blank until roadmap media is supported. Clear this field before publishing.', issueNumber);
  if (/^\s*#{1,6}\s/m.test(values[0] + '\n' + values[1])) fail('Public fields must not contain extra headings.', issueNumber);
  return { title: toPlainText(values[0], 'title', issueNumber), summary: toPlainText(values[1], 'summary', issueNumber) };
}
function categoriesFor(labels, issueNumber) {
  const tags = labels.filter(label => label.startsWith('tag:'));
  if (tags.length < 1 || tags.length > 3 || tags.some(tag => !tag.startsWith('tag: '))) fail('Add 1 to 3 category labels using tag: Category.', issueNumber);
  const seen = new Set();
  const categories = tags.map(tag => {
    const category = tag.slice(5);
    if (!/^[\p{L}\p{N}][\p{L}\p{N} &'’–-]*$/u.test(category) || category !== category.trim() || /\s{2}/.test(category)) fail('Each category label must be a short, readable name.', issueNumber);
    const clean = toPlainText(category, 'category', issueNumber);
    if (clean !== category) fail('A category label contains a reference or formatting.', issueNumber);
    const key = clean.toLocaleLowerCase('en-GB');
    if (seen.has(key)) fail('Category labels must be unique, ignoring letter case.', issueNumber);
    seen.add(key);
    return clean;
  });
  return categories.sort(compare);
}
function closedDate(value, now, issueNumber) {
  if (typeof value !== 'string') fail('Completed items need a valid closed_at date.', issueNumber);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fail('Completed items need a valid closed_at date.', issueNumber);
  const [, ys, ms, ds, hs, mins, ss, zone] = match;
  const [year, month, day, hour, minute, second] = [ys, ms, ds, hs, mins, ss].map(Number);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = zone === 'Z' ? [0, 0] : zone.slice(1).split(':').map(Number);
  const parsed = new Date(value);
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > maxDay || hour > 23 || minute > 59 || second > 59 || offset[0] > 14 || offset[1] > 59 || (offset[0] === 14 && offset[1]) || !Number.isFinite(parsed.getTime()) || parsed > now) fail('Completed items need a real, non-future closed_at date.', issueNumber);
  return parsed;
}
const compare = (a, b) => a.localeCompare(b, 'en-GB') || (a < b ? -1 : a > b ? 1 : 0);
const compareCategories = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) { const result = compare(a[i], b[i]); if (result) return result; }
  return a.length - b.length;
};
const compareItems = (a, b) => compareCategories(a.categories, b.categories) || compare(a.title, b.title) || compare(a.summary, b.summary);

export function buildSnapshot(issues, { now = new Date() } = {}) {
  if (!Array.isArray(issues) || !(now instanceof Date) || !Number.isFinite(now.getTime())) fail('Invalid roadmap input.');
  const accepted = [], inWorks = [], completed = [], numbers = new Set(), publicNames = new Set();
  for (const issue of issues) {
    if (!plainObject(issue)) fail('GitHub returned an invalid issue record.');
    if (has(issue, 'pull_request')) continue;
    const n = issue.number;
    if (!Number.isSafeInteger(n) || n < 1) fail('GitHub returned an invalid issue number.');
    if (numbers.has(n)) fail('The source changed or repeated during pagination. Retry after reviewing the labels.', n);
    numbers.add(n);
    if (!Array.isArray(issue.labels)) fail('Issue labels are missing.', n);
    const labels = issue.labels.map(x => typeof x === 'string' ? x : x?.name);
    if (labels.some(x => typeof x !== 'string')) fail('Issue labels are malformed.', n);
    const status = labels.filter(x => x.startsWith('roadmap:'));
    if (status.length !== 1 || !Object.values(STATUS_LABELS).includes(status[0])) fail('Apply exactly one supported roadmap status label after review.', n);
    const categories = categoriesFor(labels, n), fields = parsePublicFields(issue.body, n);
    const item = { categories, title: fields.title, summary: fields.summary };
    const key = categories.join('\0').toLocaleLowerCase('en-GB') + '\0' + fields.title.toLocaleLowerCase('en-GB');
    if (publicNames.has(key)) fail('The public categories and title duplicate another roadmap item.', n);
    publicNames.add(key);
    if ([STATUS_LABELS.accepted, STATUS_LABELS.inWorks].includes(status[0])) {
      if (issue.state !== 'open' || issue.closed_at !== null || ![null, 'reopened'].includes(issue.state_reason)) fail('Accepted and in-works items must be open with no completion date.', n);
      (status[0] === STATUS_LABELS.accepted ? accepted : inWorks).push(item);
    } else {
      if (issue.state !== 'closed' || issue.state_reason !== 'completed') fail('A completed label requires an issue closed as completed.', n);
      const date = closedDate(issue.closed_at, now, n);
      completed.push({ date, month: date.toISOString().slice(0, 7), item });
    }
  }
  accepted.sort(compareItems);
  inWorks.sort(compareItems);
  completed.sort((a, b) => b.date - a.date || compareItems(a.item, b.item));
  const delivered = [];
  for (const { month, item } of completed) {
    const year = Number(month.slice(0, 4));
    let group = delivered.at(-1);
    if (!group || group.year !== year) { group = { year, months: [] }; delivered.push(group); }
    let bucket = group.months.at(-1);
    if (!bucket || bucket.month !== month) { bucket = { month, label: MONTHS[Number(month.slice(5)) - 1], items: [] }; group.months.push(bucket); }
    bucket.items.push(item);
  }
  const snapshot = { schemaVersion: 2, scope: 'theme-features', accepted, inWorks, delivered };
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(snapshot) {
  if (plainObject(snapshot) && snapshot.schemaVersion === 1) fail('Roadmap schema 1 is no longer supported. Fetch a schema 2 snapshot before publishing.');
  exactKeys(snapshot, ['schemaVersion', 'scope', 'accepted', 'inWorks', 'delivered'], 'roadmap');
  if (snapshot.schemaVersion !== 2 || snapshot.scope !== 'theme-features' || !Array.isArray(snapshot.accepted) || !Array.isArray(snapshot.inWorks) || !Array.isArray(snapshot.delivered)) fail('Invalid roadmap schema or scope.');
  const seen = new Set();
  const validateItem = item => {
    exactKeys(item, ['categories', 'title', 'summary'], 'public item');
    for (const field of ['title', 'summary']) if (toPlainText(item[field], field) !== item[field]) fail(`Public ${field} is not plain text.`);
    if (!Array.isArray(item.categories) || item.categories.some(category => typeof category !== 'string')) fail('Public categories must be an array of readable names.');
    const sorted = categoriesFor(item.categories.map(category => 'tag: ' + category));
    if (sorted.some((category, index) => category !== item.categories[index])) fail('Public categories must be sorted.');
    const key = item.categories.join('\0').toLocaleLowerCase('en-GB') + '\0' + item.title.toLocaleLowerCase('en-GB');
    if (seen.has(key)) fail('Duplicate public roadmap item.'); seen.add(key);
  };
  for (const items of [snapshot.accepted, snapshot.inWorks]) {
    items.forEach(validateItem);
    if (items.some((item, i) => i && compareItems(items[i - 1], item) > 0)) fail('Accepted and in-works items must be sorted by categories and title.');
  }
  let previousYear = Infinity;
  for (const group of snapshot.delivered) {
    exactKeys(group, ['year', 'months'], 'delivery year');
    if (!Number.isInteger(group.year) || group.year < 2000 || group.year >= previousYear || !Array.isArray(group.months) || !group.months.length) fail('Delivery years must be non-empty and newest first.');
    previousYear = group.year;
    let previousMonth = 13;
    for (const bucket of group.months) {
      exactKeys(bucket, ['month', 'label', 'items'], 'delivery month');
      if (typeof bucket.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(bucket.month)) fail('Invalid delivery month.');
      const month = Number(bucket.month.slice(5));
      if (Number(bucket.month.slice(0, 4)) !== group.year || month >= previousMonth || bucket.label !== MONTHS[month - 1] || !Array.isArray(bucket.items) || !bucket.items.length) fail('Delivery months must match their year and label, with newest first.');
      previousMonth = month; bucket.items.forEach(validateItem);
    }
  }
  return snapshot;
}
function nextPage(link, current, expected) {
  if (!link) return null;
  const parts = link.split(/,\s*(?=<)/);
  const parsed = parts.map(part => /^<([^>]+)>;\s*rel="([^"]+)"$/.exec(part.trim()));
  if (parsed.some(part => !part)) fail('GitHub returned malformed pagination.');
  const next = parsed.filter(part => part[2].split(' ').includes('next'));
  if (next.length > 1) fail('GitHub returned ambiguous pagination.');
  if (!next.length) return null;
  let url; try { url = new URL(next[0][1]); } catch { fail('GitHub returned invalid pagination.'); }
  const pageText = url.searchParams.get('page'), page = Number(pageText);
  const allowed = ['state', 'labels', 'per_page', 'page', 'sort', 'direction', 'after'];
  const canonicalPath = /^\/repositories\/[1-9]\d*\/issues$/.test(url.pathname);
  if (url.origin !== expected.origin || (url.pathname !== expected.pathname && !canonicalPath) || url.username || url.password || url.hash || !/^[1-9]\d*$/.test(pageText || '') || page !== current + 1 || [...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) fail('GitHub returned unsafe or inconsistent pagination.');
  for (const key of ['labels', 'state', 'per_page', 'sort', 'direction']) if (url.searchParams.get(key) !== expected.searchParams.get(key)) fail('GitHub returned an inconsistent pagination query.');
  const after = url.searchParams.get('after');
  if (after !== null && (!after || after.length > 2048 || /[\x00-\x20\x7f]/.test(after))) fail('GitHub returned an invalid pagination cursor.');
  // GitHub emits numeric /repositories/<id>/issues links. Never follow that
  // supplied path: retain our validated owner/repository and only carry the
  // server's opaque cursor into the next request to the same repository.
  const safe = new URL(expected);
  safe.searchParams.set('page', String(page));
  if (after === null) safe.searchParams.delete('after'); else safe.searchParams.set('after', after);
  return safe;
}
export async function fetchRoadmap({ repository, token, fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository.split('/').some(x => x === '.' || x === '..')) fail('Set GITHUB_REPOSITORY to owner/repository.');
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) fail('Set GH_TOKEN or GITHUB_TOKEN for the roadmap fetch.');
  const issues = [];
  for (const label of Object.values(STATUS_LABELS)) {
    let url = new URL(`https://api.github.com/repos/${repository}/issues`);
    for (const [key, value] of Object.entries({ state: 'all', labels: label, per_page: '100', page: '1', sort: 'created', direction: 'asc' })) url.searchParams.set(key, value);
    do {
      const page = Number(url.searchParams.get('page'));
      if (page > 100) fail('Roadmap pagination exceeded its safety limit.');
      let response;
      try { response = await fetchImpl(url.href, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' }, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
      catch { fail('GitHub roadmap request failed. The existing snapshot was not changed.'); }
      if (!response.ok) fail(`GitHub roadmap request failed with HTTP ${Number.isInteger(response.status) ? response.status : 'error'}. The existing snapshot was not changed.`);
      let batch; try { batch = await response.json(); } catch { fail('GitHub returned an unreadable roadmap response.'); }
      if (!Array.isArray(batch) || batch.length > 100) fail('GitHub returned an invalid roadmap page.');
      for (const issue of batch) {
        if (plainObject(issue) && has(issue, 'pull_request')) continue;
        if (!plainObject(issue) || !Array.isArray(issue.labels) || !issue.labels.some(value => (typeof value === 'string' ? value : value?.name) === label)) fail('Issue labels changed during the roadmap query. Review and retry.', issue?.number);
      }
      issues.push(...batch);
      url = nextPage(response.headers.get('link'), page, url);
    } while (url !== null);
  }
  return buildSnapshot(issues, { now });
}
export async function writeSnapshotAtomic(output, snapshot) {
  validateSnapshot(snapshot);
  const destination = resolve(output), temporary = destination + `.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(dirname(destination), { recursive: true });
  try { await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o644 }); await rename(temporary, destination); }
  catch { await unlink(temporary).catch(() => {}); fail('The roadmap snapshot could not be written.'); }
}
async function main(argv) {
  let mode, output = DEFAULT_OUTPUT, suppliedOutput = false;
  for (let i = 0; i < argv.length; i++) {
    if (['--check', '--fetch'].includes(argv[i]) && !mode) mode = argv[i];
    else if (argv[i] === '--output' && !suppliedOutput && argv[i + 1] && !argv[i + 1].startsWith('--')) { output = argv[++i]; suppliedOutput = true; }
    else fail('Usage: node scripts/roadmap.mjs (--check | --fetch) [--output PATH]');
  }
  if (!mode) fail('Choose --check or --fetch.');
  if (mode === '--check') {
    let snapshot; try { snapshot = JSON.parse(await readFile(output, 'utf8')); } catch { fail('The roadmap snapshot could not be read as JSON.'); }
    validateSnapshot(snapshot); console.log('Roadmap snapshot is valid. This checks structure, not editorial approval or live delivery.');
  } else {
    const snapshot = await fetchRoadmap({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
    await writeSnapshotAtomic(output, snapshot);
    console.log('Roadmap snapshot updated from reviewed status labels. Only public theme-feature fields were written.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(error instanceof RoadmapError ? error.message : 'Roadmap update failed. The existing snapshot was not changed.'); process.exitCode = 1; });
