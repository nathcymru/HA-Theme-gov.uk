import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['scripts/generate-themes.mjs'], { stdio: 'inherit' });
await build({ entryPoints: ['card/src/card.ts'], bundle: true, format: 'esm', outfile: 'card/dist/govuk-house-lighting-card.js', target: 'es2022' });
await build({ entryPoints: ['ui/src/civica-ui.ts'], bundle: true, format: 'esm', outfile: 'ui/dist/civica-ui.js', target: 'es2022' });
mkdirSync('ui/dist/brand', { recursive: true });
for (const part of ['logo', 'icons']) cpSync(`brand/civica/${part}`, `ui/dist/brand/${part}`, { recursive: true });
console.log('Built lighting card, colour settings companion and supplied brand assets.');
