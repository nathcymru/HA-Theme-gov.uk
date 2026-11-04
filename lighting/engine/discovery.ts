import type { Snapshot, RoomSource } from './types.ts';

/** Label that marks a light as owned by another automation. The engine never drives these. */
export const RESERVED_LABEL = 'govuk_lighting_reserved';
export const isReserved = (s: Snapshot, id: string) => !!s.entities[id]?.labels?.includes(RESERVED_LABEL);
const isLight = (id: string) => id.startsWith('light.');
const members = (s: Snapshot, id: string): string[] | null => {
  const e = s.states[id]?.attributes?.entity_id;
  return Array.isArray(e) && e.length ? e : null; // light groups expose their members here
};

/** Entity's effective area: entity override, else its device's area. */
export function effectiveArea(s: Snapshot, id: string): string | null {
  const e = s.entities[id];
  if (!e) return null;
  return e.area_id ?? (e.device_id ? s.devices[e.device_id]?.area_id ?? null : null);
}

/** Expand groups to their member lights (cycle-safe); groups themselves never count as lights. */
function expand(s: Snapshot, id: string, seen = new Set<string>()): string[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const m = members(s, id);
  return m ? m.filter(isLight).flatMap((x) => expand(s, x, seen)) : [id];
}

/** Every light that belongs to the room, including reserved ones. */
export function resolveRoomMembers(s: Snapshot, room: RoomSource): string[] {
  const out = new Set<string>();
  const add = (id: string) => expand(s, id).forEach((x) => out.add(x));
  const candidates = new Set<string>([...Object.keys(s.entities), ...Object.keys(s.states)].filter(isLight));
  if (room.area) for (const id of candidates) {
    const reg = s.entities[id];
    if (reg?.disabled_by || reg?.hidden_by) continue;
    if (effectiveArea(s, id) === room.area) add(id);
  }
  (room.entities ?? []).forEach(add);
  (room.include ?? []).forEach(add);
  for (const x of room.exclude ?? []) expand(s, x).forEach((m) => out.delete(m));
  // A group listed only through its own id could leave a stale non-light; keep lights present in state or registry.
  return [...out].filter((id) => isLight(id) && (s.states[id] || s.entities[id])).sort();
}

/** Lights the engine may drive: members minus reserved. */
export const resolveRoomLights = (s: Snapshot, room: RoomSource): string[] => resolveRoomMembers(s, room).filter((id) => !isReserved(s, id));
export const resolveReserved = (s: Snapshot, room: RoomSource): string[] => resolveRoomMembers(s, room).filter((id) => isReserved(s, id));
