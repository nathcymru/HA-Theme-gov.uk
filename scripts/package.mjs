import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = 'dist/civica-home-assistant';
rmSync(root, { recursive: true, force: true });
mkdirSync(`${root}/www/civica`, { recursive: true });
cpSync('ui/dist', `${root}/www/civica`, { recursive: true });
mkdirSync(`${root}/www/civica/card/dist`, { recursive: true });
cpSync('card/dist/govuk-house-lighting-card.js', `${root}/www/civica/card/dist/govuk-house-lighting-card.js`);
cpSync('card/assets', `${root}/www/civica/card/assets`, { recursive: true });
cpSync('themes', `${root}/themes/civica`, { recursive: true });
cpSync('cards', `${root}/examples/cards`, { recursive: true });
for (const name of ['LICENSE', 'ARTWORK.md', 'VERIFICATION.md']) cpSync(name, `${root}/${name}`);
cpSync('INSTALL.md', `${root}/README.md`);
cpSync('lighting', `${root}/lighting`, { recursive: true });
cpSync('design-system', `${root}/design-system`, { recursive: true });
cpSync('brand/civica', `${root}/brand/civica`, { recursive: true });
mkdirSync(`${root}/docs`, { recursive: true });
for (const name of ['source', 'build', 'data', 'config', 'scripts', 'config.rb', 'Gemfile', 'Gemfile.lock', 'README.md']) {
  if (existsSync(`docs/${name}`)) cpSync(`docs/${name}`, `${root}/docs/${name}`, { recursive: true });
}
writeFileSync(`${root}/configuration.example.yaml`, `# Merge these keys into your existing frontend configuration.\nfrontend:\n  themes: !include_dir_merge_named themes\n  extra_module_url:\n    - /local/civica/civica-ui.js?v=1\n\n# Add the lighting card as a dashboard JavaScript module resource:\n# /local/civica/card/dist/govuk-house-lighting-card.js?v=1\n`);
rmSync('dist/civica-home-assistant.zip', { force: true });
execFileSync('zip', ['-qr', '../civica-home-assistant.zip', '.'], { cwd: root });
console.log('Created dist/civica-home-assistant.zip');
