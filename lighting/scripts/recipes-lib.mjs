// Validates the canonical recipe file and derives preview CSS. No dependencies.
import { readFileSync } from 'node:fs';

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const SOURCE = new URL('../recipes/recipes.json', import.meta.url);

export function load(path = SOURCE) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validate(doc) {
  const errors = [];
  const err = (m) => errors.push(m);
  const seen = new Set();
  const slug = (s, where) => {
    if (!/^[a-z][a-z0-9_]*$/.test(s ?? '')) err(`${where}: invalid slug ${s}`);
    if (seen.has(s)) err(`${where}: duplicate slug ${s}`);
    seen.add(s);
  };
  const rgb = (v, where) => {
    if (!Array.isArray(v) || v.length !== 3 || v.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) err(`${where}: invalid RGB`);
  };
  if (doc.schemaVersion !== 1) err('schemaVersion must be 1');
  if (doc.whites?.length !== 4) err('expected 4 whites');
  if (doc.colors?.length !== 7) err('expected 7 colors');
  if (doc.scenes?.length !== 5) err('expected 5 scenes');
  for (const w of doc.whites ?? []) {
    slug(w.slug, 'white'); if (!HEX.test(w.preview)) err(`${w.slug}: bad preview`);
    for (const b of ['hue', 'innr']) if (!(w.kelvin?.[b] >= 1000 && w.kelvin[b] <= 10000)) err(`${w.slug}: bad kelvin.${b}`);
    if (!(w.brightnessPct > 0 && w.brightnessPct <= 100)) err(`${w.slug}: bad brightness`);
  }
  for (const c of doc.colors ?? []) {
    slug(c.slug, 'color'); if (!HEX.test(c.preview)) err(`${c.slug}: bad preview`);
    rgb(c.hue, `${c.slug}.hue`); rgb(c.innr, `${c.slug}.innr`);
  }
  for (const s of doc.scenes ?? []) {
    slug(s.slug, 'scene');
    if (!(s.transitionS >= 0)) err(`${s.slug}: bad transition`);
    if (!s.stops?.length || s.stops.some(([p, c]) => !(p >= 0 && p <= 100) || !HEX.test(c))) err(`${s.slug}: bad stops`);
    for (const p of s.palette ?? []) if (!p.kelvin && !(HEX.test(p.hue) && HEX.test(p.innr))) err(`${s.slug}/${p.name}: palette needs kelvin or hue+innr`);
    if (s.safety?.flashing && !(s.safety.disabledByDefault && s.safety.requiresOptIn && s.safety.maxRuntimeS > 0)) err(`${s.slug}: flashing scenes need safety opt-in and max runtime`);
  }
  return errors;
}

export const gradient = (stops) => `linear-gradient(90deg, ${stops.map(([p, c]) => `${c.toUpperCase()} ${p}%`).join(', ')})`;
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Flat catalogue shared by every generator. */
export function catalogue(doc) {
  return [
    ...doc.whites.map((w) => ({ id: w.slug, version: 1, category: 'white', label: w.label, preview: w.preview, ...w })),
    ...doc.colors.map((c) => ({ id: c.slug, version: 1, category: 'color', label: c.label, previewCss: c.preview, ...c })),
    ...doc.scenes.map((s) => ({ id: s.slug, version: 1, category: 'scene', previewCss: gradient(s.stops), ...s })),
  ];
}
