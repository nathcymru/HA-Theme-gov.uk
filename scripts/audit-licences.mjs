// Evidence inventory, not a legal-clearance or licence-compatibility certificate.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
assert.ok(process.argv.slice(2).every(arg => ['--check', '--write'].includes(arg)), 'Use --check or --write');
const inventoryPath = 'licences/dependencies.json';
// A project-specific reference, not an SPDX-listed or OSI-approved licence.
const projectLicenceExpression = 'LicenseRef-civica-Free-Use-1.0';
const historicalProjectLicence = {
  path: 'licences/history/LICENSE-v1.4.1.txt',
  sha256: '355e0fe8ecb21ab04610f27a1e001a2980f95cf66a10f15883b7bac07935ae7f',
  expression: 'MIT',
  source_commit: 'd6dd7c869fd419baa8ee29a572b4b69ddd639f14',
  source_tag_at_review: 'v1.4.1',
  source_url: 'https://github.com/nathcymru/civica/blob/d6dd7c869fd419baa8ee29a572b4b69ddd639f14/LICENSE',
  scope: 'Exact published project notice retained as historical evidence of prior permissions, including the MIT grant. Its historical attribution introduction is not a substitute for the current third-party review.',
};
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = path => digest(readFileSync(path));
const save = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
const safe = name => name.replace(/^@/, '').replaceAll('/', '__');
const lock = json('package-lock.json');
const gemLock = read('docs/Gemfile.lock');
const rootPackage = json('package.json');
const sorted = values => [...new Set(values)].sort();
function projectLicence() {
  assert.equal(hash(historicalProjectLicence.path), historicalProjectLicence.sha256, 'Published historical project notice must remain byte-identical');
  return {
    path: 'LICENSE', sha256: hash('LICENSE'), expression: projectLicenceExpression,
    identifier_type: 'Project-specific LicenseRef; not an SPDX-listed or OSI-approved licence',
    scope: 'Original civica contributions supplied under these terms, subject to the licence exclusions for prior permissions, third-party components and separately licensed artwork. This is not a licence expression for the whole mixed distribution.',
    previous_permissions_cutoff_commit: historicalProjectLicence.source_commit,
    historical_notice: historicalProjectLicence,
  };
}
const direct = Object.keys({...rootPackage.dependencies, ...rootPackage.devDependencies}).sort();
const lockEntries = Object.entries(lock.packages).filter(([path]) => path).sort(([a], [b]) => a.localeCompare(b));
function dependenciesOf(path) {
  return Object.keys(lock.packages[path]?.dependencies || {}).map(name => {
    let parent = path;
    while (parent) {
      const target = `${parent}/node_modules/${name}`;
      if (lock.packages[target]) return target;
      parent = parent.includes('/node_modules/') ? parent.slice(0, parent.lastIndexOf('/node_modules/')) : '';
    }
    return `node_modules/${name}`;
  }).filter(path => lock.packages[path]);
}
function closure(names) {
  const found = new Set();
  const visit = path => { if (found.has(path)) return; found.add(path); dependenciesOf(path).forEach(visit); };
  names.forEach(name => visit(`node_modules/${name}`)); return found;
}
const scopeSets = {
  documentation_dependency: closure(['echarts', 'maplibre-gl', '@versatiles/style']),
  build_tool: closure(['esbuild', 'typescript', 'yaml']),
  test_tool: closure(['@axe-core/playwright', '@playwright/test']),
};
const scopeFor = path => Object.entries(scopeSets).filter(([, paths]) => paths.has(path)).map(([name]) => name);
const listFiles = dir => existsSync(dir) ? readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() && !['node_modules','.git'].includes(entry.name) ? listFiles(`${dir}/${entry.name}`) : entry.isFile() ? [`${dir}/${entry.name}`] : []) : [];
const licenceFiles = dir => listFiles(dir).filter(path => /(?:licen[cs]e|copying|notice|copyright)/i.test(path.split('/').at(-1)) && !/\.(?:rb|js|ts|map|html|scss|gemspec)$/i.test(path));
function noticeRecords(dir, id, copy) {
  let paths = licenceFiles(dir), extracted;
  // Some published packages carry their complete notice in the README.
  if (!paths.length) {
    for (const file of listFiles(dir).filter(p => /^readme(?:\.|$)/i.test(p.split('/').at(-1)))) {
      const text = read(file), match = /^(?:#{1,6}|={1,6})\s*(?:License|Licence|Copyright)[^\n]*\n/im.exec(text);
      if (match) {
        const section = text.slice(match.index);
        if (/Permission is hereby granted|Redistribution and use/.test(section)) { paths = [file]; extracted = section; break; }
      }
    }
  }
  return paths.sort().map(source => {
    const content = extracted ?? readFileSync(source);
    const destination = `licences/notices/${id}/${relative(dir, source)}${extracted ? '.licence-section.txt' : ''}`;
    if (copy) save(destination, content);
    return {source_file:relative(dir,source),...(copy ? {path:destination} : {}),sha256:digest(content),extracted_verbatim_section:Boolean(extracted)};
  });
}
function gemVersions() {
  const records = new Map();
  for (const match of gemLock.split('\nPLATFORMS\n')[0].matchAll(/^    ([\w.-]+) \(([^)]+)\)$/gm)) {
    const [,name,full] = match;
    const [,version,platform] = /^([\d.]+)(?:-(.+))?$/.exec(full) || [];
    assert.ok(version, `Unrecognised gem version ${full}`);
    const id = `${name}@${version}`;
    if (!records.has(id)) records.set(id,{name,version,platforms:[]});
    records.get(id).platforms.push(platform || 'ruby');
  }
  return [...records.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
async function bundleEvidence() {
  const definitions = [
    ['home-assistant-card','card/src/card.ts'],['home-assistant-companion','ui/src/index.ts'],
    ['documentation-charts','ui/dev/energy-charts-harness.ts'],['documentation-maps','docs/javascript/map-examples.mjs'],
    ['documentation-map-worker','node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'],
  ];
  const records=[];
  for(const [id,entry] of definitions){
    const result=await build({absWorkingDir:process.cwd(),entryPoints:[entry],bundle:true,format:'esm',target:'es2022',write:false,metafile:true,logLevel:'silent'});
    const packages=sorted(Object.keys(result.metafile.inputs).filter(p=>p.startsWith('node_modules/')).map(p=>p.match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)[0]));
    records.push({id,entry,packages,scope:'Resolved input packages from an esbuild write:false trace; prebundled library internals require their own notices and dependency metadata.'});
  }
  return records;
}
async function generate() {
  for (const part of ['npm','gems','embedded']) rmSync(`licences/notices/${part}`, {recursive:true,force:true});
  const gemSpecs=JSON.parse(execFileSync('bundle',['exec','ruby','-rjson','-e','puts JSON.generate(Bundler.load.specs.map { |s| {name:s.name,version:s.version.to_s,platform:s.platform.to_s,licenses:s.licenses,path:s.full_gem_path,homepage:s.homepage} })'],{cwd:'docs',encoding:'utf8'}));
  const npm=lockEntries.map(([path,entry])=>{
    const name=entry.name || path.split('node_modules/').at(-1), installed=existsSync(`${path}/package.json`), metadata=installed?json(`${path}/package.json`):null;
    if(metadata)assert.equal(metadata.version,entry.version,`${name}: installed version differs from lock`);
    const scopes=scopeFor(path);if(!scopes.length)scopes.push('optional_platform_build_or_test_tool');
    const shipped=scopes.includes('documentation_dependency');
    let notices=installed?noticeRecords(path,`npm/${safe(name)}-${entry.version}`,shipped):[];
    return {name,version:entry.version,lock_path:path,declared_licence:entry.license || metadata?.license || null,direct:direct.includes(name),scopes,optional:Boolean(entry.optional),integrity:entry.integrity || null,resolved:entry.resolved || null,installed_during_review:installed,notice_evidence:notices,review_limit:!installed?'Optional platform package absent from this review environment; lock metadata only.':!notices.length?'No standalone complete notice located; metadata only.':shipped?'Verbatim notices retained; dependency membership does not imply every source file or type declaration is bundled.':'Build/test tool notice filenames and hashes recorded; tool code is not part of the shipped Home Assistant modules.'};
  });
  const gems=gemVersions().map(entry=>{
    const spec=gemSpecs.find(s=>s.name===entry.name&&s.version===entry.version);assert.ok(spec,`Missing installed gem ${entry.name}`);
    const copy=['govuk_tech_docs','rouge'].includes(entry.name);
    const notices=noticeRecords(spec.path,`gems/${safe(entry.name)}-${entry.version}`,copy);
    const licences=spec.licenses.length?spec.licenses: ['compass','servolux'].includes(entry.name)?['MIT']:[];
    return {...entry,declared_licences:spec.licenses,reviewed_licences:licences,licence_basis:spec.licenses.length?'gemspec metadata; retain actual notice terms':'MIT permission text in installed notice/README, despite absent gemspec field',homepage:spec.homepage,scope:copy?'documentation-derived-assets-and-build-tool':'documentation-build-tool',reviewed_platform:spec.platform,notice_evidence:notices,review_limit:'One installed platform reviewed. Other locked binary variants may carry additional bundled notices; no distribution of these build-tool binaries is claimed.'};
  });
  const tech=gemSpecs.find(s=>s.name==='govuk_tech_docs');
  const embeddedRoot=`${tech.path}/node_modules`;
  const embedded=readdirSync(embeddedRoot).filter(name=>existsSync(`${embeddedRoot}/${name}/package.json`)).sort().map(name=>{
    const dir=`${embeddedRoot}/${name}`,meta=json(`${dir}/package.json`),shipped=name==='govuk-frontend';
    const notices=noticeRecords(dir,`embedded/${name}-${meta.version}`,shipped);
    if(shipped&&!notices.length)notices.push({path:'licences/upstream/govuk-frontend-6.6.0-LICENSE.txt',sha256:hash('licences/upstream/govuk-frontend-6.6.0-LICENSE.txt'),source_url:'https://raw.githubusercontent.com/alphagov/govuk-frontend/v6.6.0/LICENSE.txt'});
    return {name,version:meta.version,declared_licence:meta.license,container:'govuk_tech_docs@6.6.0',scope:shipped?'documentation-css-and-component-javascript':'documentation-build-tool',notice_evidence:notices};
  });
  const result={schema_version:1,reviewed_on:'2026-11-13',purpose:'Exact dependency and notice evidence, not a guarantee of rights clearance or legal compatibility.',inputs:{'package-lock.json':hash('package-lock.json'),'docs/Gemfile.lock':hash('docs/Gemfile.lock')},project_licence:projectLicence(),direct_npm_dependencies:direct,npm,gems,embedded_npm:embedded,bundler:{version:gemLock.match(/BUNDLED WITH\n\s+([^\n]+)/)?.[1],scope:'documentation-build-tool',licence:'MIT',notice_status:'Toolchain metadata only; installed default-gem directory does not contain a standalone notice.'},bundles:await bundleEvidence(),upstream_notice_sources:json('licences/upstream/sources.json'),limitations:['Package licence metadata is evidence, not permission for unrelated artwork or trademarks.','The npm devDependency field does not describe redistribution: documentation examples bundle chart/map libraries.','Ruby platform variants and npm optional platform tools are inventoried from the lock but only locally installed notices are inspected.','GOV.UK Frontend code terms do not authorise Crown marks or GDS Transport fonts; the project excludes those identity assets.','Map data, remote tiles/glyphs and providers have separate attribution/usage terms. The map example retains visible OpenStreetMap credit.','Supplied project marks and the retained household floor plan do not have an independently established blanket redistribution licence; consult ARTWORK.md.','Native Home Assistant libraries and MDI icons are supplied by Home Assistant, not redistributed as another engine/icon package by the companion.']};
  save(inventoryPath,JSON.stringify(result,null,2)+'\n');return result;
}
async function check() {
  const data=json(inventoryPath);
  assert.deepEqual(data.project_licence, projectLicence(), 'Original-work licence or historical scope changed; review the inventory');
  assert.equal(rootPackage.license, 'SEE LICENSE IN LICENSE', 'Package metadata must identify the custom project licence file');
  assert.equal(lock.packages[''].license, rootPackage.license, 'Package lock must retain the same custom licence metadata');
  assert.ok(read('LICENSE.md').includes(read('LICENSE').trim()),'LICENSE.md must retain the complete LICENSE text verbatim');
  for(const [path,value] of Object.entries(data.inputs))assert.equal(hash(path),value,`${path}: dependency lock changed; refresh the licence inventory`);
  assert.deepEqual(data.direct_npm_dependencies,direct,'Direct dependencies changed');
  assert.deepEqual(data.npm.map(x=>[x.lock_path,x.version]),lockEntries.map(([p,x])=>[p,x.version]),'Every locked npm package must be inventoried exactly once');
  assert.deepEqual(data.gems.map(x=>({name:x.name,version:x.version,platforms:x.platforms})),gemVersions(),'Every locked gem/platform must be inventoried');
  const all=[...data.npm,...data.gems,...data.embedded_npm];
  for(const dependency of all)for(const n of dependency.notice_evidence)if(n.path)assert.equal(hash(n.path),n.sha256,`${dependency.name}: verbatim notice changed`);
  for(const n of data.upstream_notice_sources)assert.equal(hash(n.path),n.sha256,'Pinned upstream notice changed');
  const retained = sorted([...all.flatMap(d => d.notice_evidence.filter(n => n.path).map(n => n.path)), ...data.upstream_notice_sources.map(n => n.path)].filter(p => p.startsWith('licences/notices/')));
  assert.deepEqual(listFiles('licences/notices').sort(),retained,'Every retained notice must have a provenance record');
  for(const dependency of data.npm)if(existsSync(`${dependency.lock_path}/package.json`))assert.equal(json(`${dependency.lock_path}/package.json`).version,dependency.version,`${dependency.name}: installed version mismatch`);
  assert.deepEqual(await bundleEvidence(), data.bundles, 'Resolved bundle inputs changed; review distribution scope and refresh notices');
  assert.ok(data.bundles.filter(x=>x.id.startsWith('home-assistant-')).every(x=>x.packages.length===0),'HA runtime third-party bundle scope changed');
  for (const dependency of data.npm.filter(x => x.scopes.includes('documentation_dependency'))) assert.ok(dependency.notice_evidence.some(n => n.path), `${dependency.name}: distributed dependency needs a retained notice`);
  console.log(`Licence evidence checked: ${data.npm.length} npm lock entries, ${data.gems.length} gem versions, ${data.embedded_npm.length} gem-vendored npm packages. Artwork and remote-service rights remain separate.`);
}
if(process.argv.includes('--write'))await generate();
await check();
