import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// Source-only mode is useful while authors work. CI must run the default mode
// after Middleman, which also checks the rendered links and public JSON.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceOnly = process.argv.includes('--source-only');
const dataRoot = path.join(root, 'docs/data');
const buildRoot = path.join(root, 'docs/build');
const read = name => JSON.parse(fs.readFileSync(path.join(dataRoot, name), 'utf8'));
const coverage = read('ha-interface-coverage.json');
const terminology = read('ha-terminology.json');
const crosswalk = read('uk-design-system-crosswalk.json');
const writing = read('writing-guide-inventory.json');
const verification = read('ha-coverage-verification.json');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const same = (a, b, message) => { try { assert.deepStrictEqual(a, b); } catch { failures.push(message); } };
const sorted = values => [...values].sort();
const unique = (values, name) => check(new Set(values).size === values.length, `${name}: duplicate identifiers`);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const routeCache = new Map();
const examples = new Map();
for (const file of fs.readdirSync(dataRoot).filter(name => name.endsWith('.yml'))) {
  const doc = YAML.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8'));
  for (const [id, record] of Object.entries(doc?.examples || {})) {
    check(!examples.has(id), `Duplicate example ${id}`);
    examples.set(id, record);
  }
}
function route(raw, context) {
  check(typeof raw === 'string' && raw.startsWith('/'), `${context}: expected an absolute local route`);
  if (typeof raw !== 'string' || !raw.startsWith('/')) return;
  const [pathname, fragment] = raw.split('#');
  check(!pathname.split('/').includes('..'), `${context}: unsafe route ${raw}`);
  if (sourceOnly) {
    const stem = path.join(root, 'docs/source', pathname);
    const exists = pathname.startsWith('/examples/')
      ? examples.has(path.basename(pathname, '.html'))
      : ['', '.md.erb', '.erb'].some(suffix => fs.existsSync(stem + suffix));
    check(exists, `${context}: source route does not exist: ${raw}`);
    return;
  }
  const file = path.join(buildRoot, pathname);
  if (!routeCache.has(file)) routeCache.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  const html = routeCache.get(file);
  check(html !== null, `${context}: built route does not exist: ${raw}`);
  if (html && fragment) {
    const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]));
    check(ids.has(decodeURIComponent(fragment)), `${context}: built anchor does not exist: ${raw}`);
  }
}
function example(id, context) {
  check(examples.has(id), `${context}: unknown example ${id}`);
  route(`/examples/${id}.html`, context);
}
function sourceRefs(refs, sources, context) {
  check(Array.isArray(refs) && refs.length > 0, `${context}: source references required`);
  for (const id of refs || []) check(sources.has(id), `${context}: undefined source ${id}`);
}

// Denominators are explicit pinned source snapshots, never an arbitrary fixed
// count in the validator. Missing/extra/duplicated members all fail.
unique(coverage.sources.map(x => x.id), 'Coverage sources');
unique(coverage.categories.map(x => x.id), 'Coverage categories');
unique(coverage.entries.map(x => x.id), 'Coverage entries');
const sourceIds = new Set(coverage.sources.map(x => x.id));
const categoryIds = new Set(coverage.categories.map(x => x.id));
for (const source of coverage.sources) {
  check(sha(source.sha256), `${source.id}: missing source/index SHA-256`);
  check(/^https:\/\//.test(source.url), `${source.id}: missing source URL`);
  check(source.ref === coverage.baseline.frontend_sha || source.ref === coverage.baseline.core_sha || source.ref === coverage.baseline.website_sha, `${source.id}: source pin differs from the declared baseline`);
}
for (const category of coverage.categories) {
  unique(category.expected_ids, `${category.id} denominator`);
  sourceRefs(category.source_ids, sourceIds, category.id);
  const actual = coverage.entries.filter(entry => entry.category === category.id).map(entry => entry.native_id);
  same(sorted(actual), sorted(category.expected_ids), `${category.id}: registry has missing or extra mapped IDs`);
  check(category.count === category.expected_ids.length, `${category.id}: stale category count`);
}
for (const entry of coverage.entries) {
  check(categoryIds.has(entry.category), `${entry.id}: undefined category`);
  sourceRefs(entry.source_ids, sourceIds, entry.id);
  for (const key of ['guide', 'component', 'style', 'pattern']) route(entry[key], `${entry.id} ${key}`);
  check(entry.examples?.length > 0, `${entry.id}: needs a meaningful specimen`);
  for (const id of entry.examples || []) example(id, entry.id);
  same(entry.example_paths, (entry.examples || []).map(id => `/examples/${id}.html`), `${entry.id}: stale example paths`);
  check(entry.reference_status === 'mapped_to_reference_specification', `${entry.id}: reference status must remain explicit`);
  check(entry.native_verification === 'not_asserted_by_this_inventory', `${entry.id}: a source mapping cannot assert native verification`);
  if (entry.source_members) {
    unique(entry.source_members, `${entry.id} source members`);
    const known = new Set(entry.source_ids.flatMap(id => coverage.sources.find(source => source.id === id)?.members?.map(member => member.path) || []));
    for (const member of entry.source_members) check(known.has(member), `${entry.id}: source member not present in a pinned index: ${member}`);
  }
}
same(coverage.totals, { categories: coverage.categories.length, entries: coverage.entries.length, unmapped_entries: 0, reference_only_entries: coverage.entries.length }, 'Coverage totals do not match the records');

// Two independently authored inventories must agree on the native identifiers.
unique(terminology.terms.map(x => x.id), 'Terminology terms');
unique(terminology.native_values.map(x => x.id), 'Native labels');
const terms = new Map(terminology.terms.map(term => [term.id, term]));
const termSources = new Set(terminology.sources.map(source => source.id));
// These two records explicitly reference existing glossary/helper terms instead
// of assigning every reused term to a new category. All original inventories
// still require exact category membership below.
const domainReferenceInventories = new Set(['additional-state-domains', 'other-documented-domains']);
const referencedDomainTermIds = new Set();
const otherDomainOwners = {
  plant: '/home-assistant/specialist-entities.html#environment',
  zone: '/home-assistant/maps-and-zones.html#example-ha-flow-017-zone',
  schedule: '/home-assistant/schedules-and-time.html#ha-ctrl-010-capabilities',
};
for (const inventory of terminology.inventories) {
  unique(inventory.entry_ids, `${inventory.id} terminology denominator`);
  check(inventory.denominator === inventory.entry_ids.length, `${inventory.id}: stale terminology denominator`);
  sourceRefs(inventory.source_ids, termSources, inventory.id);
  for (const id of inventory.entry_ids) check(terms.has(id), `${inventory.id}: missing term ${id}`);
  if (domainReferenceInventories.has(inventory.id)) {
    check(inventory.coverage === 'complete-for-explicit-domain-list', `${inventory.id}: explicit reference-inventory schema required`);
    check(Array.isArray(inventory.native_domain_ids), `${inventory.id}: native domain IDs required`);
    const nativeIds = inventory.native_domain_ids || [];
    unique(nativeIds, `${inventory.id} native domain IDs`);
    check(nativeIds.length === inventory.entry_ids.length, `${inventory.id}: domains and reused terms must pair one-to-one`);
    const expected = inventory.id === 'additional-state-domains'
      ? coverage.categories.find(category => category.id === 'additional-state-domains').expected_ids
      : Object.keys(otherDomainOwners);
    same(sorted(nativeIds), sorted(expected), `${inventory.id}: reference domains differ from their bounded source scope`);
    nativeIds.forEach((domain, index) => {
      const id = inventory.entry_ids[index];
      const term = terms.get(id);
      check(term?.code_identifiers?.includes(domain), `${inventory.id}: ${id} does not preserve exact domain ${domain}`);
      const sourceId = `ha-supplement-${domain}`;
      check(inventory.source_ids.includes(sourceId) && term?.source_ids?.includes(sourceId), `${inventory.id}: ${id} lacks its corresponding ${domain} source`);
      referencedDomainTermIds.add(id);
      if (inventory.id === 'additional-state-domains') {
        const mapping = coverage.entries.find(entry => entry.category === 'additional-state-domains' && entry.native_id === domain);
        check(Boolean(mapping), `${inventory.id}: no interface mapping for ${domain}`);
        if (mapping) route(mapping.guide, `${domain} reused-domain mapping`);
      } else route(otherDomainOwners[domain], `${domain} documented-domain owner`);
    });
  } else {
    check(!('native_domain_ids' in inventory), `${inventory.id}: unexpected reference schema cannot bypass category membership`);
    same(sorted(terminology.terms.filter(term => term.category === (inventory.id === 'entity-platforms' ? 'entity-platform' : inventory.id)).map(term => term.id)), sorted(inventory.entry_ids), `${inventory.id}: terminology category differs from its source denominator`);
  }
}
same(sorted(terminology.inventories.filter(inventory => domainReferenceInventories.has(inventory.id)).map(inventory => inventory.id)), sorted(domainReferenceInventories), 'Both explicit domain-reference inventories must remain present');
for (const term of terminology.terms.filter(term => term.category === 'additional-entity-domains')) check(referencedDomainTermIds.has(term.id), `${term.id}: supplementary domain term is absent from its reference inventory`);
for (const term of terminology.terms) {
  sourceRefs(term.source_ids, termSources, term.id);
  route(term.local_path, term.id);
  check(Boolean(term.first_use_explanation && term.avoid_confusion && term.household_wording), `${term.id}: incomplete explanation or distinction`);
}
for (const [termCategory, interfaceCategory] of [['card-types', 'dashboard-card-types'], ['card-features', 'card-feature-types'], ['selector-types', 'selector-dispatch'], ['view-types', 'view-types'], ['entity-platform', 'entity-platforms']]) {
  const expected = coverage.categories.find(category => category.id === interfaceCategory)?.expected_ids;
  check(Boolean(expected), `Missing interface category ${interfaceCategory}`);
  const actual = terminology.terms.filter(term => term.category === termCategory).flatMap(term => term.code_identifiers || []);
  same(sorted(actual), sorted(expected || []), `${termCategory}: terminology and interface registry identifiers differ`);
}
const kindCounts = {};
const domains = new Set(coverage.categories.find(x => x.id === 'entity-platforms').expected_ids);
for (const term of terminology.native_values) {
  check(termSources.has(term.source_id), `${term.id}: undefined native-label source`);
  check(domains.has(term.domain), `${term.id}: native value has an unregistered platform`);
  check(Boolean(term.native_label_pointer && term.native_label && term.avoid_confusion), `${term.id}: incomplete contextual native label`);
  route(term.local_path, term.id);
  kindCounts[term.kind] = (kindCounts[term.kind] || 0) + 1;
}
same(terminology.native_values_coverage.kind_counts, kindCounts, 'Native-label kind counts differ');
check(terminology.native_values_coverage.denominator === terminology.native_values.length, 'Native-label denominator differs');
same(terminology.source_versions.frontend.commit, coverage.baseline.frontend_sha, 'Frontend pins differ');
same(terminology.source_versions.home_assistant_core.commit, coverage.baseline.core_sha, 'Core pins differ');
same(terminology.source_versions.website.commit, coverage.baseline.website_sha, 'Website pins differ');

// UK catalogues, owning guidance and every existing/new HA task family.
unique(crosswalk.ha_mappings.map(x => x.id), 'UK mappings');
const mappings = new Map(crosswalk.ha_mappings.map(mapping => [mapping.id, mapping]));
const decisions = new Set(Object.keys(crosswalk.decision_definitions));
const gaps = read('ha-component-gaps.json').findings.map(finding => finding.id);
same(sorted(crosswalk.ha_mappings.filter(mapping => mapping.ha_gap_id).map(mapping => mapping.ha_gap_id)), sorted(gaps), 'UK mappings do not cover every existing HA task specification');
const additionalGuides = [...coverage.new_guides, '/home-assistant/integration-and-app-settings.html', '/home-assistant/system-and-developer-tools.html'];
same(sorted(crosswalk.ha_mappings.filter(mapping => !mapping.ha_gap_id).map(mapping => `/home-assistant/${mapping.family_slug}.html`)), sorted(additionalGuides), 'UK mappings do not cover every added HA task family');
let indexCount = 0, catalogueCount = 0;
for (const system of crosswalk.systems) {
  for (const index of system.indexes) {
    indexCount++;
    check(sha(index.response_sha256), `${index.url}: missing dated catalogue hash`);
    unique(index.items.map(item => item.url), `${index.url} items`);
    for (const item of index.items) {
      catalogueCount++;
      check(decisions.has(item.decision) && item.reason, `${item.url}: missing source decision/reason`);
      if (item.existing_local_route) route(item.existing_local_route, item.url);
      for (const id of item.ha_mapping_ids || []) check(mappings.has(id), `${item.url}: unknown HA mapping ${id}`);
    }
  }
}
for (const mapping of crosswalk.ha_mappings) {
  check(decisions.has(mapping.decision), `${mapping.id}: undefined decision`);
  check(mapping.source_urls?.length && mapping.adaptation && mapping.implementation_scope && mapping.acceptance?.length, `${mapping.id}: incomplete evidence or adaptation boundary`);
  for (const local of mapping.local_routes) route(local, mapping.id);
}
check(crosswalk.counts.uk_systems === crosswalk.systems.length, 'UK system count differs');
check(crosswalk.counts.catalogue_indexes === indexCount, 'UK index count differs');
check(crosswalk.counts.catalogue_entries === catalogueCount, 'UK catalogue count differs');
check(crosswalk.counts.ha_task_mappings === crosswalk.ha_mappings.length, 'UK family count differs');
for (const id of crosswalk.slider_review.examples) example(id, 'Slider review');
route(crosswalk.slider_review.local_route, 'Slider review');

// Catch CSS-only-looking names that have no definition. These new examples use
// data-* hooks for behaviour; no undocumented civica-* hook exemptions exist.
const css = fs.readdirSync(path.join(root, 'docs/source/stylesheets')).filter(name => name.endsWith('.scss')).map(name => fs.readFileSync(path.join(root, 'docs/source/stylesheets', name), 'utf8')).join('\n');
const definedClasses = new Set([...css.matchAll(/\.((?:civica-)[a-zA-Z0-9_-]+)/g)].map(match => match[1]));
for (const file of ['ha-controls-examples.yml', 'ha-flows-examples.yml', 'ha-coverage-examples.yml', 'ha-administration-examples.yml', 'terminology-examples.yml', 'slider-examples.yml']) {
  const doc = YAML.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8'));
  for (const [id, record] of Object.entries(doc.examples)) {
    const classes = [...record.html.matchAll(/\bclass=["']([^"']+)["']/g)].flatMap(match => match[1].split(/\s+/));
    for (const name of classes.filter(name => name.startsWith('civica-'))) check(definedClasses.has(name), `${id}: undefined civica class ${name}`);
  }
}

check(typeof verification.status === 'string' && Boolean(verification.scope), 'Verification record needs an explicit current status and bounded scope');
check(Array.isArray(verification.checklists) && Array.isArray(verification.review_loops), 'Verification record must preserve review/checklist evidence while work progresses');

if (!sourceOnly) {
  for (const [filename, expected] of [['ha-interface-coverage.json', coverage], ['ha-terminology.json', terminology], ['uk-design-system-crosswalk.json', crosswalk], ['ha-coverage-verification.json', verification]]) {
    const file = path.join(buildRoot, 'reference', filename);
    check(fs.existsSync(file), `Missing public JSON ${filename}`);
    if (fs.existsSync(file)) same(JSON.parse(fs.readFileSync(file, 'utf8')), expected, `Public ${filename} differs from its owning source`);
  }
  const publicWriting = path.join(buildRoot, 'reference/writing-guide.json');
  check(fs.existsSync(publicWriting), 'Missing public writing-guide.json');
  if (fs.existsSync(publicWriting)) {
    const record = JSON.parse(fs.readFileSync(publicWriting, 'utf8'));
    const supplement = record.terminology_supplement;
    delete record.terminology_supplement;
    same(record, writing, 'Published writing rules differ from their frozen owning source');
    check(supplement?.record === 'ha-terminology.json' && supplement.reviewed_on === terminology.reviewed_on && Boolean(supplement.scope), 'Writing-guide terminology supplement is missing or stale');
    if (supplement?.guide) route(path.posix.resolve('/reference', supplement.guide), 'Writing-guide terminology supplement');
  }
}
if (failures.length) {
  console.error(`Home Assistant coverage validation failed (${failures.length}):\n${[...new Set(failures)].map(message => `- ${message}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Home Assistant coverage: ${coverage.entries.length} mapped entries in ${coverage.categories.length} registries; ${terminology.terms.length} terms, ${terminology.native_values.length} contextual labels and ${crosswalk.ha_mappings.length} UK task mappings valid${sourceOnly ? ' (source-only; rendered checks not run)' : ', including rendered routes/anchors, all four public registry/evidence JSON outputs and the writing-guide supplement'}.`);
}
