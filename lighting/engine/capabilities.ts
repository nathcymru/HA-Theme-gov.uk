import type { Snapshot, LightCapability, RoomSource, RoomLightingCapabilities, RecipeAvailability, Availability } from './types.ts';
import { resolveRoomLights } from './discovery.ts';

const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];

export function lightCapability(s: Snapshot, id: string): LightCapability {
  const st = s.states[id];
  const reg = s.entities[id];
  const dev = reg?.device_id ? s.devices[reg.device_id] : undefined;
  const base = { entityId: id, manufacturer: dev?.manufacturer, model: dev?.model, platform: reg?.platform };
  if (!st) return { ...base, status: 'unknown', color: false, colorTemp: false, dimmable: false, onOffOnly: false };
  const modes: string[] = st.attributes.supported_color_modes ?? [];
  if (st.state === 'unavailable' || st.state === 'unknown') {
    // Offline is not "incapable": keep last-known modes if the state still reports them.
    return { ...base, status: st.state === 'unavailable' ? 'unavailable' : 'unknown', ...flags(modes), ...range(st.attributes) };
  }
  return { ...base, status: 'available', ...flags(modes), ...range(st.attributes) };
}
function flags(modes: string[]) {
  const color = modes.some((m) => COLOR_MODES.includes(m));
  const colorTemp = modes.includes('color_temp');
  const dimmable = color || colorTemp || modes.includes('brightness') || modes.includes('white');
  return { color, colorTemp, dimmable, onOffOnly: modes.length > 0 && !dimmable };
}
function range(a: Record<string, any>) {
  const r: { minKelvin?: number; maxKelvin?: number } = {};
  if (typeof a.min_color_temp_kelvin === 'number') r.minKelvin = a.min_color_temp_kelvin;
  if (typeof a.max_color_temp_kelvin === 'number') r.maxKelvin = a.max_color_temp_kelvin;
  return r;
}

type Recipe = { id: string; category: 'white' | 'color' | 'scene'; label: string; minColorLights?: number };

export function recipeAvailability(caps: LightCapability[], r: Recipe): RecipeAvailability {
  const mk = (availability: Availability, reason?: string): RecipeAvailability => ({ recipeId: r.id, availability, reason });
  if (caps.length === 0) return mk('unsupported', 'no_lights');
  const live = caps.filter((c) => c.status === 'available');
  if (live.length === 0) return mk('unsupported', 'all_unavailable');
  const colour = live.filter((c) => c.color).length;
  if (r.category === 'color') {
    // Never claim a whole-room colour while members are offline or can't produce it.
    if (live.length < caps.length) return mk('unsupported', 'members_unavailable');
    return colour === live.length ? mk('full') : mk('unsupported', 'needs_all_colour');
  }
  if (r.category === 'white') {
    const useful = live.filter((c) => c.colorTemp || c.color || c.dimmable);
    if (!useful.length) return mk('unsupported', 'no_dimmable_lights');
    const full = live.length === caps.length && live.every((c) => c.colorTemp || c.color);
    return full ? mk('full') : mk('adaptive', 'some_lights_cannot_change_temperature');
  }
  const need = r.minColorLights ?? 1;
  if (colour < need) return mk('unsupported', 'needs_colour_light');
  return colour === live.length && live.length === caps.length ? mk('full') : mk('adaptive', 'adapts_to_available_lights');
}

export function assessRoom(s: Snapshot, room: RoomSource, recipes: Recipe[]): RoomLightingCapabilities {
  const caps = resolveRoomLights(s, room).map((id) => lightCapability(s, id));
  const live = caps.filter((c) => c.status === 'available');
  return {
    roomId: room.id, totalLights: caps.length, availableLights: live.length,
    unavailableLights: caps.filter((c) => c.status === 'unavailable').length,
    unknownLights: caps.filter((c) => c.status === 'unknown').length,
    colorLights: live.filter((c) => c.color).length,
    colorTemperatureLights: live.filter((c) => c.colorTemp).length,
    dimmableLights: live.filter((c) => c.dimmable).length,
    onOffOnlyLights: live.filter((c) => c.onOffOnly).length,
    allSupportColor: live.length > 0 && live.every((c) => c.color),
    someSupportColor: live.some((c) => c.color),
    allSupportColorTemperature: live.length > 0 && live.every((c) => c.colorTemp || c.color),
    lightCapabilities: caps,
    availableRecipes: recipes.map((r) => recipeAvailability(caps, r)),
  };
}
