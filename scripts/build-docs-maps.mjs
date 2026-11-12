import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('docs/source/javascripts', { recursive: true });
await build({ entryPoints: ['docs/javascript/map-examples.mjs'], bundle: true, format: 'esm', target: 'es2022', outfile: 'docs/source/javascripts/map-examples.js', legalComments: 'inline' });
// .mjs stays a stable same-origin worker URL; Middleman hashes the page module.
await build({ entryPoints: ['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'], bundle: true, format: 'esm', target: 'es2022', outfile: 'docs/source/javascripts/maplibre-gl-worker.mjs', legalComments: 'inline' });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl.css', 'docs/source/stylesheets/maplibre-examples.css');
const notices = [
  ['MapLibre GL JS 6.16.0', 'node_modules/maplibre-gl/LICENSE.txt'],
  ['VersaTiles Style 7.0.1', 'node_modules/@versatiles/style/LICENSE.md'],
].map(([name, path]) => `${name}\n${readFileSync(path, 'utf8')}`).join('\n\n');
writeFileSync('docs/source/reference/map-demo-licenses.txt', `${notices}\n\nMap data: © OpenStreetMap contributors, Open Database Licence.\nhttps://www.openstreetmap.org/copyright\nThe map example loads data only after explicit activation.\n`);
console.log('Built documentation-only OpenStreetMap examples and bundled renderer notices.');
