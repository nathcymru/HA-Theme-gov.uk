import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['scripts/generate-themes.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-brand.mjs'], { stdio: 'inherit' });
await build({ entryPoints: ['card/src/card.ts'], bundle: true, format: 'esm', outfile: 'card/dist/govuk-house-lighting-card.js', target: 'es2022' });
// Bundle the deferred entry as one file: no extra chunk or second network
// request, but component evaluation must remain behind the HA-ready boundary.
await build({ entryPoints: ['ui/src/index.ts'], bundle: true, format: 'esm', outfile: 'ui/dist/civica-ui.js', target: 'es2022' });
// A real ECharts renderer is used by the public examples and regression fixture.
// It is deliberately separate from the HA runtime, which uses HA's own renderer.
await build({ entryPoints: ['ui/dev/energy-charts-harness.ts'], bundle: true, format: 'esm', outfile: 'ui/dev/energy-charts-harness.js', target: 'es2022' });
mkdirSync('docs/source/javascripts', { recursive: true });
cpSync('ui/dev/energy-charts-harness.js', 'docs/source/javascripts/energy-chart-examples.js');
// A newer archive supersedes the complete old package. Remove stale filenames
// so previous-generation artwork cannot leak into an installation ZIP.
rmSync('ui/dist/brand', { recursive: true, force: true });
mkdirSync('ui/dist/brand', { recursive: true });
for (const part of ['core', 'icons', 'themes']) cpSync(`brand/civica/${part}`, `ui/dist/brand/${part}`, { recursive: true });
console.log('Built lighting card, colour settings companion and supplied brand assets.');
