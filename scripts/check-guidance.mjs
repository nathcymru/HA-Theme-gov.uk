// Coverage and evidence integrity, not an automated judgement of writing quality.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import YAML from 'yaml';

const read = path => readFileSync(path, 'utf8');
const json = name => JSON.parse(read(`docs/data/${name}.json`));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(`${dir}/${item.name}`) : [`${dir}/${item.name}`]);
const unique = (values, label) => assert.equal(new Set(values).size, values.length, `${label}: duplicate identifier`);
const same = (actual, expected, label) => assert.deepEqual([...actual].sort(), [...expected].sort(), label);
const guides = files('docs/source').filter(path => /\.html\.(?:md\.)?erb$/.test(path) && /^---\n[\s\S]*?\btitle:/.test(read(path)));
const brand = json('brand-guidance-inventory');
const writing = json('writing-guide-inventory');
const audit = json('design-system-audit');
const work = json('guidance-work-package');
const rules = [...brand.rules, ...writing.rules];
unique(rules.map(rule => rule.id), 'Rules');
const ids = new Set(rules.map(rule => rule.id));
assert.equal(brand.pages.length, 4, 'Four requested brand chapters');
assert.equal(writing.pages.length, 10, 'Ten writing chapters');
assert.ok(brand.rules.length >= 30 && writing.rules.length >= 40, 'Substantive rule coverage');
for (const source of [brand, writing]) {
  const sourceIds = new Set(source.sources.map(item => item.id));
  unique([...source.sources.map(item => item.id)], 'Source IDs');
  for (const rule of source.rules) {
    assert.ok(rule.source_ids.length, `${rule.id}: provenance`);
    for (const id of rule.source_ids) assert.ok(sourceIds.has(id), `${rule.id}: unknown source ${id}`);
    assert.ok(['MUST', 'SHOULD', 'MAY'].includes(rule.level), `${rule.id}: normative level`);
    assert.ok(rule.scope && rule.requirement, `${rule.id}: scope and requirement`);
  }
}
for (const id of ids) {
  const route = audit.rule_links[id];
  assert.ok(route, `${id}: public rule link`);
  const [path, anchor] = route.split('#');
  assert.ok(anchor, `${id}: stable anchor`);
  assert.ok(read(`docs/build${path}`).includes(`id="${anchor}"`), `${id}: rendered rule anchor`);
}
unique(audit.pages.map(page => page.path), 'Reviewed pages');
same(audit.pages.map(page => page.path), guides, 'Every current guide needs an explicit review record');
for (const page of audit.pages) {
  assert.ok(page.note && page.reviewed_rule_families.length, `${page.path}: review rationale`);
  assert.ok(['no_confirmed_finding', 'finding', 'documented_deviation'].includes(page.result), `${page.path}: review outcome`);
  assert.equal(page.sha256, hash(page.path), `${page.path}: changed since the recorded review`);
}
const examples = {};
for (const path of files('docs/data').filter(path => path.endsWith('-examples.yml'))) {
  for (const [id, value] of Object.entries(YAML.parse(read(path)).examples)) {
    assert.ok(!examples[id], `Duplicate example ${id}`); examples[id] = value;
  }
}
unique(audit.examples.map(item => item.id), 'Reviewed examples');
same(audit.examples.map(item => item.id), Object.keys(examples), 'Every example needs an explicit coverage record');
for (const example of audit.examples) assert.ok(example.owners.length && example.review_note, `${example.id}: ownership and review scope`);
const recommendations = audit.migration_recommendations;
assert.ok(Array.isArray(recommendations), 'Migration recommendations remain separate from confirmed findings');
unique([...audit.findings, ...recommendations].map(item => item.id), 'Findings and recommendation IDs');
const findingIds = new Set(audit.findings.map(item => item.id));
for (const page of audit.pages) for (const id of page.finding_ids) assert.ok(findingIds.has(id), `${page.path}: unknown finding ${id}`);
for (const finding of [...audit.findings, ...recommendations]) {
  assert.ok(finding.title && finding.summary && finding.proposed_change, `${finding.id}: explanation and proposed change`);
  assert.ok(['P1', 'P2', 'P3'].includes(finding.priority), `${finding.id}: explicit priority`);
  assert.ok(finding.rule_ids.length && finding.evidence.length && finding.acceptance.length, `${finding.id}: actionable evidence`);
  unique(finding.rule_ids, `${finding.id} rule references`);
  for (const id of finding.rule_ids) assert.ok(ids.has(id), `${finding.id}: unknown rule ${id}`);
  for (const criterion of finding.acceptance) assert.ok(typeof criterion === 'string' && criterion.trim(), `${finding.id}: non-empty acceptance criterion`);
  for (const evidence of finding.evidence) {
    assert.ok(existsSync(evidence.path), `${finding.id}: missing evidence path ${evidence.path}`);
    const lines = read(evidence.path).split('\n');
    assert.ok(Number.isInteger(evidence.line) && evidence.line >= 1 && evidence.line <= lines.length, `${finding.id}: invalid evidence line`);
    assert.ok(evidence.detail, `${finding.id}: evidence rationale`);
    if (evidence.excerpt) assert.equal(lines[evidence.line - 1].trim(), evidence.excerpt, `${finding.id}: evidence excerpt changed`);
  }
}
for (const recommendation of recommendations) {
  assert.ok(['proposed_migration', 'proposed_improvement', 'implemented_pending_verification', 'resolved'].includes(recommendation.status), `${recommendation.id}: explicit recommendation status`);
}
for (const finding of [...audit.findings, ...recommendations]) {
  if (!['resolved', 'implemented_pending_verification'].includes(finding.status)) continue;
  assert.ok(finding.original_evidence?.revision && finding.original_evidence.records.length, `${finding.id}: retain original evidence`);
  assert.ok(finding.resolution?.summary && finding.resolution.verification_scope, `${finding.id}: bounded resolution`);
  same(finding.resolution.acceptance_checks.map(item => item.criterion), finding.acceptance, `${finding.id}: every acceptance criterion is addressed`);
  assert.ok(existsSync(finding.resolution.evidence_record), `${finding.id}: verification record exists`);
  if (finding.status === 'resolved') {
    assert.ok(finding.resolution.acceptance_checks.every(item => item.status === 'verified_in_stated_scope'), `${finding.id}: no unchecked acceptance`);
    assert.equal(JSON.parse(read(finding.resolution.evidence_record)).automated_status, 'passed', `${finding.id}: executed checks required`);
  }
}
for (const name of ['brand-guidance-checklist', 'writing-guide-checklist', 'component-audit-checklist']) {
  const publicPath = `docs/build/reference/${name}.json`;
  assert.ok(existsSync(publicPath), `${name}: public checklist is rendered`);
  assert.deepEqual(JSON.parse(read(publicPath)), json(name), `${name}: rendered checklist must match its complete source record`);
}
for (const record of audit.source_snapshots) assert.equal(hash(record.path), record.sha256, `${record.path}: changed after source review`);
for (const phase of work.phases) for (const item of phase.items) {
  assert.ok(['complete', 'pending', 'not_tested'].includes(item.status), `${item.id}: checklist status`);
  if (item.status === 'complete') assert.ok(item.evidence.length, `${item.id}: no evidence for completion`);
}
assert.ok(work.loops.length >= 3, 'Record repeated coverage and verification loops');

// Preserve the original route inventory while checking implemented ownership.
// A completed specification is not a new native Home Assistant implementation.
const components = json('component-rationalisation');
const gaps = json('ha-component-gaps');
const componentChecklist = json('component-audit-checklist');
const routeFor = path => path.replace(/^docs\/source/, '').replace(/\.html\.(?:md\.)?erb$/, '.html');
const currentRoutes = new Map(guides.map(path => [routeFor(path), path]));
const pageRecords = components.pageInventory;
unique(pageRecords.map(page => page.url), 'Component inventory guide routes');
const pagesByRoute = new Map(pageRecords.map(page => [page.url, page]));
assert.equal(pageRecords.filter(page => page.baselineMember !== false).length, components.baseline.guides, 'Preserved baseline guide count');
const isComponent = route => /^\/(?:publishing\/)?components\//.test(route) && !route.endsWith('/index.html');
const componentPages = pageRecords.filter(page => page.kind === 'component');
assert.equal(componentPages.filter(page => page.baselineMember !== false).length, 68, 'All 68 baseline component routes');
assert.equal(componentPages.filter(page => page.baselineMember !== false).length, components.baseline.totalComponentPages, 'Declared baseline component count');
assert.equal(componentPages.length, components.current.componentPages, 'Current component count includes additions');
assert.equal(new Set(componentPages.map(page => page.canonicalOwner)).size, components.current.componentCanonicalOwners, 'Current canonical owner count');
same(componentPages.map(page => page.url), [...currentRoutes.keys()].filter(isComponent), 'Every existing component route maps exactly once');
for (const page of pageRecords) {
  assert.equal(currentRoutes.get(page.url), page.sourceFile, `${page.url}: existing source route`);
  assert.ok(pagesByRoute.has(page.canonicalOwner), `${page.url}: missing canonical owner`);
  assert.equal(pagesByRoute.get(page.canonicalOwner).canonicalOwner, page.canonicalOwner, `${page.url}: owner must resolve directly, without a cycle`);
  assert.equal(page.publishedUrlDisposition, 'retain', `${page.url}: audit preserves the published URL`);
  assert.equal(page.proposedRedirect, null, `${page.url}: no implemented redirect is claimed`);
}
unique(components.families.map(family => family.id), 'Canonical family IDs');
unique(components.families.map(family => family.canonicalOwner), 'Canonical family owners');
for (const family of components.families) {
  const members = pageRecords.filter(page => page.familyId === family.id);
  assert.ok(members.length && pagesByRoute.has(family.canonicalOwner), `${family.id}: existing owner and members`);
  same(family.memberPages, members.map(page => page.url), `${family.id}: complete member routes`);
  same(family.componentPages, members.filter(page => page.kind === 'component').map(page => page.url), `${family.id}: component membership`);
  for (const page of members) assert.equal(page.canonicalOwner, family.canonicalOwner, `${page.url}: family owner`);
}
const familyIds = new Set(components.families.map(family => family.id));
for (const page of pageRecords) assert.ok(familyIds.has(page.familyId), `${page.url}: unknown family`);
unique(components.aliasProposals.map(alias => alias.from), 'Proposed alias routes');
same(components.aliasProposals.map(alias => alias.from), pageRecords.filter(page => page.url !== page.canonicalOwner).map(page => page.url), 'Every non-owner route has a preservation proposal');
for (const alias of components.aliasProposals) {
  assert.ok(pagesByRoute.has(alias.from) && pagesByRoute.has(alias.canonicalOwner), `${alias.from}: alias routes resolve`);
  assert.equal(alias.canonicalOwner, pagesByRoute.get(alias.from).canonicalOwner, `${alias.from}: alias agrees with owner map`);
  assert.equal(alias.relationship, pagesByRoute.get(alias.from).relationship, `${alias.from}: alias relationship`);
  assert.equal(alias.publishedUrlRetained, true, `${alias.from}: published URL retained`);
}
for (const proposal of components.deprecationProposals) {
  if (proposal.page) {
    assert.ok(pagesByRoute.has(proposal.page) && pagesByRoute.has(proposal.replacementOwner), `${proposal.id}: deprecation routes resolve`);
    assert.equal(proposal.deletePage, false, `${proposal.id}: no page deletion`);
    assert.equal(proposal.redirect, false, `${proposal.id}: no redirect`);
  }
  if (proposal.runtimeName) assert.equal(proposal.removeRegistration, false, `${proposal.id}: runtime alias retained`);
}

const expectedMappings = new Map();
for (const [name, key] of [['govuk-components-inventory', 'components'], ['nhs-components-inventory', 'components'], ['nhs-patterns-inventory', 'patterns'], ['publishing-inventory', 'items']]) {
  for (const entry of json(name)[key]) {
    const sourceId = entry.id || entry.source_slug;
    expectedMappings.set(`docs/data/${name}.json:${sourceId}`, {
      localPage: entry.local_path || entry.localPage || routeFor(entry.documentation_path),
      sourceUrl: entry.source_url || entry.sourceUrl,
    });
  }
}
const mappingKey = entry => `${entry.catalogueFile}:${entry.sourceId}`;
unique(components.sourceMappings.map(mappingKey), 'Component source mappings');
same(components.sourceMappings.map(mappingKey), [...expectedMappings.keys()], 'All four source catalogues retain their mappings');
for (const entry of components.sourceMappings) {
  const expected = expectedMappings.get(mappingKey(entry));
  assert.equal(entry.localPage, expected.localPage, `${entry.sourceId}: source route`);
  assert.equal(entry.sourceUrl, expected.sourceUrl, `${entry.sourceId}: source URL`);
  const page = pagesByRoute.get(entry.localPage);
  assert.ok(page, `${entry.sourceId}: mapped page exists`);
  assert.equal(entry.canonicalOwner, page.canonicalOwner, `${entry.sourceId}: canonical owner`);
  assert.equal(entry.familyId, page.familyId, `${entry.sourceId}: canonical family`);
}
assert.equal(components.sourceMappings.length, components.baseline.sourceCatalogueEntries, 'Source mapping count');
unique(components.exampleInventory.map(example => example.id), 'Baseline example IDs');
assert.equal(components.exampleInventory.filter(example => example.baselineMember !== false).length, components.baseline.examples, 'Preserved baseline example count');
assert.equal(components.exampleInventory.length, components.current.ownershipExamples, 'Current ownership includes added examples');
for (const example of components.exampleInventory) {
  assert.ok(examples[example.id] && pagesByRoute.has(example.ownerPage), `${example.id}: example and owner exist`);
  same(example.referencedBy, pageRecords.filter(page => page.examples.includes(example.id)).map(page => page.url), `${example.id}: complete baseline references`);
  assert.ok(example.referencedBy.length, `${example.id}: orphaned baseline example`);
}
const baselineExampleIds = new Set(components.exampleInventory.map(example => example.id));
for (const page of pageRecords) for (const id of page.examples) assert.ok(baselineExampleIds.has(id), `${page.url}: unmapped example ${id}`);

const proposals = [...components.findings, ...gaps.findings];
unique(proposals.map(proposal => proposal.id), 'Component and HA gap proposal IDs');
assert.equal(components.findings.length, 14, 'Fourteen component organisation proposals');
assert.equal(gaps.findings.length, 30, 'Thirty Home Assistant specification gaps');
const proposalIds = new Set(proposals.map(proposal => proposal.id));
const rulesById = new Map(rules.map(rule => [rule.id, rule]));
const checkEvidence = (evidence, label) => {
  assert.ok(existsSync(evidence.file), `${label}: missing evidence file ${evidence.file}`);
  const lines = read(evidence.file).split('\n');
  assert.ok(Number.isInteger(evidence.line) && evidence.line >= 1 && evidence.line <= lines.length, `${label}: invalid evidence line`);
  if (evidence.excerpt) assert.equal(lines[evidence.line - 1].trim(), evidence.excerpt, `${label}: evidence excerpt changed`);
};
for (const page of pageRecords) checkEvidence(page.evidence, page.url);
unique(gaps.sources.map(source => source.id), 'HA source IDs');
const haSourceIds = new Set(gaps.sources.map(source => source.id));
for (const proposal of proposals) {
  assert.ok(proposal.priority && proposal.scope && proposal.proposal && proposal.surfaces.length && proposal.evidence.length && proposal.acceptanceCriteria.length, `${proposal.id}: actionable proposal`);
  assert.ok(proposal.ruleDependencies.length, `${proposal.id}: frozen rule dependencies`);
  unique(proposal.ruleDependencies.map(rule => rule.id), `${proposal.id} rule dependencies`);
  for (const dependency of proposal.ruleDependencies) {
    const rule = rulesById.get(dependency.id);
    assert.ok(rule, `${proposal.id}: unknown rule ${dependency.id}`);
    assert.equal(dependency.level, rule.level, `${proposal.id}: rule level`);
    assert.equal(dependency.localPath, rule.local_path, `${proposal.id}: frozen rule anchor`);
    assert.equal(dependency.localPath, audit.rule_links[dependency.id], `${proposal.id}: rendered rule link`);
    assert.ok(proposal.dependencies.includes(dependency.id), `${proposal.id}: rule dependency is recorded`);
  }
  for (const dependency of proposal.dependencies) assert.ok(ids.has(dependency) || proposalIds.has(dependency), `${proposal.id}: unresolved dependency ${dependency}`);
  for (const evidence of proposal.evidence) checkEvidence(evidence, proposal.id);
}
for (const gap of gaps.findings) {
  assert.match(gap.id, /^HA-GAP-\d{3}$/, 'Stable HA gap identifier');
  assert.equal(gap.featureMissingClaim, false, `${gap.id}: missing specification is not missing native functionality`);
  assert.equal(gap.implementationAuthorisedByAudit, false, `${gap.id}: proposal is not implementation authority`);
  assert.ok(gap.civicaRuntime && gap.designCoverage && gap.nativeCapability.evidence, `${gap.id}: separate native, runtime and design coverage`);
  assert.ok(gap.nativeCapability.sourceIds.length, `${gap.id}: native capability provenance`);
  for (const source of gap.nativeCapability.sourceIds) assert.ok(haSourceIds.has(source), `${gap.id}: unknown native source ${source}`);
  if (gap.specification) {
    const spec = gap.specification;
    assert.equal(currentRoutes.get(spec.url), spec.path, `${gap.id}: dedicated specification resolves`);
    const markup = read(spec.path);
    const header = YAML.parse(markup.match(/^---\n([\s\S]*?)\n---/)[1]);
    assert.equal(header.gap_id, gap.id, `${gap.id}: unique owning specification`);
    const referenced = [...markup.matchAll(/example\(['"]([^'"]+)/g)].map(match => match[1]);
    assert.ok(referenced.length >= 3, `${gap.id}: complete task-specific examples`);
    same(spec.examples, referenced, `${gap.id}: current example inventory`);
    for (const id of spec.examples) assert.ok(examples[id], `${gap.id}: missing example ${id}`);
    assert.ok(read(`docs/build${spec.url}`).includes(`id="${spec.acceptance_anchor}"`), `${gap.id}: acceptance section is published`);
    assert.equal(gap.resolution.nativeFeatureImplemented, false, `${gap.id}: specification is not native implementation`);
  }
}
if (gaps.status.startsWith('specifications-')) {
  assert.equal(gaps.findings.filter(item => item.specification).length, 30, 'Every HA gap has a dedicated specification');
  unique(gaps.findings.map(item => item.specification.url), 'Dedicated HA specification routes');
}
for (const proposal of components.findings) {
  assert.match(proposal.id, /^COMP-\d{3}$/, 'Stable component proposal identifier');
  for (const route of proposal.surfaces) assert.ok(pagesByRoute.has(route), `${proposal.id}: affected guide resolves`);
}
for (const record of [components, gaps, componentChecklist]) {
  for (const [name, inventory] of [['brand', brand], ['writing', writing]]) {
    const snapshot = record.guidanceReview[name];
    const expectedFile = `docs/data/${name === 'brand' ? 'brand-guidance' : 'writing-guide'}-inventory.json`;
    assert.equal(snapshot.file, expectedFile, `${name}: correct frozen rule inventory`);
    assert.equal(snapshot.sha256, hash(snapshot.file), `${name}: frozen rules changed after proposal review`);
    assert.equal(snapshot.ruleCount, inventory.rules.length, `${name}: frozen rule count`);
    assert.equal(snapshot.authorFreezeConfirmed, true, `${name}: author freeze recorded`);
  }
}
unique(componentChecklist.loops.map(loop => loop.id), 'Component audit loop IDs');
same(componentChecklist.loops.map(loop => loop.id), ['AUDIT-LOOP-01', 'AUDIT-LOOP-02', 'AUDIT-LOOP-03', 'AUDIT-LOOP-04', 'AUDIT-LOOP-05'], 'All five audit loops are recorded');
unique(componentChecklist.loops.flatMap(loop => loop.checks.map(check => check.id)), 'Component audit check IDs');
for (const loop of componentChecklist.loops) {
  assert.ok(loop.name && loop.status && loop.gate && loop.checks.length && loop.repeatWhen.length, `${loop.id}: repeatable review loop`);
  assert.ok(loop.iterations.length, `${loop.id}: no recorded iteration`);
  unique(loop.iterations.map(iteration => iteration.iteration), `${loop.id} iterations`);
  for (const iteration of loop.iterations) {
    assert.ok(Number.isInteger(iteration.iteration) && iteration.iteration > 0 && iteration.result && iteration.evidence.length, `${loop.id}: actual outcome and evidence`);
    for (const path of iteration.evidence) assert.ok(existsSync(path), `${loop.id}: missing iteration evidence ${path}`);
  }
  for (const check of loop.checks) {
    assert.ok(check.question && componentChecklist.allowedStatuses.includes(check.status), `${check.id}: explicit question and status`);
    if (check.families) for (const gapIds of Object.values(check.families)) for (const id of gapIds) assert.ok(proposalIds.has(id), `${check.id}: unknown requirement ${id}`);
  }
}
for (const name of ['illustration-assets', 'card-artwork-provenance', 'project-artwork-provenance', 'section-artwork-provenance']) {
  const manifest = json(name);
  for (const asset of manifest.assets) {
    assert.equal(hash(asset.path), asset.sha256, `${asset.path}: artwork changed after provenance review`);
    // The section family shares the empty-alt condition; each asset also has
    // its own informative alternative for reuse outside that context.
    const sectionAlt = name === 'section-artwork-provenance' && manifest.alt_decision?.condition && asset.informative_alt;
    assert.ok(asset.purpose && (asset.alt_decision || asset.alternative_text_decision || sectionAlt), `${asset.path}: purpose and alternative-text decision`);
  }
}
console.log(`Guidance evidence is consistent: ${rules.length} rules, ${audit.pages.length} guides, ${audit.examples.length} examples, ${audit.findings.length} findings; ${componentPages.length} component routes and ${proposals.length} organisation/specification records resolve. This does not certify conformance or live runtime coverage.`);
