// Current names are checked separately from exact, preserved historical evidence.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

export const retiredName = /civica\.uk|HA-Theme-gov\.uk|civica_uk|civica-home-assistant\.zip/i;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const policyPath = 'docs/data/naming-inventory.json';
const escapePointer = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
export function stringLeaves(value, pointer = '') {
  if (typeof value === 'string') return [{ pointer, value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => stringLeaves(child, `${pointer}/${escapePointer(key)}`));
}
export function sourceParts(path, source) {
  if (path.endsWith('.json')) return { leaves: stringLeaves(JSON.parse(source)), body: '' };
  if (/\.ya?ml$/.test(path)) return { leaves: stringLeaves(YAML.parse(source)), body: '' };
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return frontmatter
    ? { leaves: stringLeaves(YAML.parse(frontmatter[1]), '/frontmatter'), body: source.slice(frontmatter[0].length) }
    : { leaves: [], body: source };
}
export function inspectSource(path, source, inventory) {
  const frozen = inventory.historical_files.find(item => item.path === path);
  if (frozen) return sha256(source) === frozen.sha256 ? [] : [`${path}: immutable historical evidence changed`];
  const issues = [];
  const { leaves, body } = sourceParts(path, source);
  for (const { pointer, value } of leaves) {
    if (!retiredName.test(value)) continue;
    const exception = inventory.historical_values.find(item => item.path === path && item.pointer === pointer && item.sha256 === sha256(value));
    if (!exception) issues.push(`${path}${pointer}: retired name in current content`);
  }
  for (const [index, line] of body.split('\n').entries()) {
    if (!retiredName.test(line)) continue;
    const exception = inventory.historical_lines.find(item => item.path === path && item.text === line);
    if (!exception) issues.push(`${path}: body line ${index + 1}: retired name in current content`);
  }
  return issues;
}
export function isNamingSource(path) {
  return path !== policyPath && !/^(?:test|tests|artifacts|dist|node_modules|docs\/(?:build|vendor|\.bundle))\//.test(path)
    && /\.(?:md|erb|html|json|ya?ml|txt|svg|ts|js|mjs|scss|css|rb|toml)$/.test(path);
}
export function checkNaming() {
  const inventory = JSON.parse(readFileSync(policyPath, 'utf8'));
  const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(path => path && existsSync(path) && isNamingSource(path)))];
  const issues = files.flatMap(path => inspectSource(path, readFileSync(path, 'utf8'), inventory));
  // Check frozen files even if a future change removes them from the source scan.
  for (const entry of inventory.historical_files) {
    if (!existsSync(entry.path)) issues.push(`${entry.path}: preserved historical evidence is missing`);
    else if (sha256(readFileSync(entry.path)) !== entry.sha256) issues.push(`${entry.path}: immutable historical evidence changed`);
  }
  if (issues.length) throw new Error(`Naming check failed:\n${issues.join('\n')}`);
  console.log(`Naming check passed: ${files.length} current source files; ${inventory.historical_files.length} immutable records and ${inventory.historical_values.length + inventory.historical_lines.length} exact historical references retained. Compatibility identifiers are intentional; supplied artwork is checked separately.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) checkNaming();
