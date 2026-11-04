export interface EntityReg { entity_id: string; device_id?: string | null; area_id?: string | null; platform?: string; disabled_by?: string | null; hidden_by?: string | null; labels?: string[] }
export interface DeviceReg { id: string; area_id?: string | null; manufacturer?: string | null; model?: string | null }
export interface HassState { entity_id: string; state: string; attributes: Record<string, any> }
export interface Snapshot { entities: Record<string, EntityReg>; devices: Record<string, DeviceReg>; states: Record<string, HassState> }
/** Where a room's membership comes from. Capabilities are never configured here. */
export interface RoomSource { id: string; name: string; area?: string; entities?: string[]; include?: string[]; exclude?: string[] }

export type Status = 'available' | 'unavailable' | 'unknown';
export interface LightCapability {
  entityId: string; status: Status;
  color: boolean; colorTemp: boolean; dimmable: boolean; onOffOnly: boolean;
  minKelvin?: number; maxKelvin?: number;
  manufacturer?: string | null; model?: string | null; platform?: string;
}
export type Availability = 'full' | 'adaptive' | 'unsupported';
export interface RecipeAvailability { recipeId: string; availability: Availability; reason?: string }
export interface RoomLightingCapabilities {
  roomId: string; totalLights: number; reservedLights: number; availableLights: number; unavailableLights: number; unknownLights: number;
  colorLights: number; colorTemperatureLights: number; dimmableLights: number; onOffOnlyLights: number;
  allSupportColor: boolean; someSupportColor: boolean; allSupportColorTemperature: boolean;
  lightCapabilities: LightCapability[]; availableRecipes: RecipeAvailability[];
}
export interface PlanStep { entityId: string; kind: 'color' | 'white' | 'brightness' | 'onoff';
  sequence: Array<{ rgb?: [number, number, number]; hex?: string; kelvin?: number; brightnessPct?: number; adjusted?: string }> }
export interface ExecutionPlan { roomId: string; recipeId: string; availability: Availability; steps: PlanStep[]; effectivePalette: string[]; skipped: string[]; transitionS: number }
