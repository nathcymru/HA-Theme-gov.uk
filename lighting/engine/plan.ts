import type { LightCapability, ExecutionPlan, PlanStep } from './types.ts';
import { recipeAvailability } from './capabilities.ts';

export type Brand = 'hue' | 'innr' | 'default';
/** Optional manufacturer optimisation; the core engine works without it. */
export const defaultBrandOf = (c: LightCapability): Brand => {
  const m = (c.manufacturer ?? '').toLowerCase();
  if (/signify|philips/.test(m)) return 'hue';
  if (/innr/.test(m)) return 'innr';
  return 'default';
};
const hexToRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const pick = (e: any, b: Brand) => (b === 'innr' ? e.innr : e.hue);
const clamp = (k: number, c: LightCapability) => Math.min(c.maxKelvin ?? k, Math.max(c.minKelvin ?? k, k));

export function buildPlan(recipe: any, caps: LightCapability[], brandOf = defaultBrandOf): ExecutionPlan {
  const av = recipeAvailability(caps, { id: recipe.id, category: recipe.category, label: recipe.label, minColorLights: recipe.minColorLights });
  const live = caps.filter((c) => c.status === 'available').sort((a, b) => a.entityId.localeCompare(b.entityId));
  const skipped = caps.filter((c) => c.status !== 'available').map((c) => c.entityId);
  const plan: ExecutionPlan = { roomId: '', recipeId: recipe.id, availability: av.availability, steps: [], effectivePalette: [], skipped, transitionS: recipe.transitionS ?? 1 };
  if (av.availability === 'unsupported') return plan;

  const whiteStep = (c: LightCapability, kelvin: number, pct = 100): PlanStep => {
    if (c.colorTemp || c.color) {
      const k = c.colorTemp ? clamp(kelvin, c) : kelvin;
      return { entityId: c.entityId, kind: 'white', sequence: [{ kelvin: k, brightnessPct: pct, adjusted: k !== kelvin ? `clamped ${kelvin}K to ${k}K` : undefined }] };
    }
    return { entityId: c.entityId, kind: c.dimmable ? 'brightness' : 'onoff', sequence: [{ brightnessPct: pct }] };
  };

  if (recipe.category === 'white') {
    const target = recipe.kelvin;
    for (const c of live) plan.steps.push(whiteStep(c, pick({ hue: target.hue, innr: target.innr }, brandOf(c)), recipe.brightnessPct));
    plan.effectivePalette = live.some((c) => c.colorTemp || c.color) ? [recipe.preview] : ['#FFFFFF'];
    return plan;
  }
  if (recipe.category === 'color') {
    for (const c of live) {
      const rgb = pick(recipe, brandOf(c)) as [number, number, number];
      plan.steps.push({ entityId: c.entityId, kind: 'color', sequence: [{ rgb, brightnessPct: 100 }] });
    }
    plan.effectivePalette = [recipe.preview];
    return plan;
  }
  // Scene: colour lights share the coloured palette (rotated by index so assignment is stable);
  // non-colour lights take the white entry or gentle brightness, never pretending to show colour.
  const colourEntries = recipe.palette.filter((p: any) => !p.kelvin);
  const whiteEntry = recipe.palette.find((p: any) => p.kelvin);
  const colourLights = live.filter((c) => c.color);
  colourLights.forEach((c, i) => {
    const b = brandOf(c);
    const seq = colourEntries.length ? colourEntries.map((_: any, k: number) => colourEntries[(i + k) % colourEntries.length]) : [];
    plan.steps.push({ entityId: c.entityId, kind: 'color', sequence: seq.map((p: any) => ({ hex: pick(p, b), rgb: hexToRgb(pick(p, b)), brightnessPct: p.brightnessPct ?? 100 })) });
  });
  live.filter((c) => !c.color).forEach((c) => {
    const k = whiteEntry?.kelvin ?? 2700;
    plan.steps.push(whiteStep(c, k, 60));
  });
  const used = new Set(plan.steps.filter((s) => s.kind === 'color').flatMap((s) => s.sequence.map((q) => q.hex!.toUpperCase())));
  plan.effectivePalette = [...used];
  if (plan.steps.some((s) => s.kind !== 'color') && whiteEntry) plan.effectivePalette.push('#FFFFFF');
  return plan;
}

/** Safe-point revision: which lights join or leave an already-running plan. */
export function diffMembership(prev: string[], next: string[]) {
  const a = new Set(prev), b = new Set(next);
  return { added: next.filter((x) => !a.has(x)).sort(), removed: prev.filter((x) => !b.has(x)).sort(), unchanged: next.filter((x) => a.has(x)).sort() };
}
