import {
  isRecord,
  toVehicleProps,
  type VehicleProps,
} from "@aicore-fivem/lib/shared";

/** ox_lib / qb-core property names of mod types 0-49 (`modEngine` = 11, ...). */
const MOD_NAMES = [
  "modSpoilers",
  "modFrontBumper",
  "modRearBumper",
  "modSideSkirt",
  "modExhaust",
  "modFrame",
  "modGrille",
  "modHood",
  "modFender",
  "modRightFender",
  "modRoof",
  "modEngine",
  "modBrakes",
  "modTransmission",
  "modHorns",
  "modSuspension",
  "modArmor",
  "modNitrous",
  "modTurbo",
  "modSubwoofer",
  "modSmokeEnabled",
  "modHydraulics",
  "modXenon",
  "modFrontWheels",
  "modBackWheels",
  "modPlateHolder",
  "modVanityPlate",
  "modTrimA",
  "modOrnaments",
  "modDashboard",
  "modDial",
  "modDoorSpeaker",
  "modSeats",
  "modSteeringWheel",
  "modShifterLeavers",
  "modAPlate",
  "modSpeakers",
  "modTrunk",
  "modHydrolic",
  "modEngineBlock",
  "modAirFilter",
  "modStruts",
  "modArchCover",
  "modAerials",
  "modTrimB",
  "modTank",
  "modWindows",
  "modDoorR",
  "modLivery",
  "modLightbar",
] as const;
/** Mods that are on / off (`ToggleVehicleMod`): stored as 0 / 1 like the lib's VehicleProps. */
const TOGGLE_MODS = new Set([17, 18, 19, 20, 21, 22]);

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : null;
const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const rgb = (v: unknown): [number, number, number] | null => {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const [r, g, b] = v.map((x) => int(x, 0, 255));
  return r != null && g != null && b != null ? [r, g, b] : null;
};

/** An ox_lib (`lib.getVehicleProperties`) or qb-core (`GetVehicleProperties`) extras table: 0 = on (ox), true = on (qb). */
function readExtras(v: unknown): Record<number, boolean> {
  const extras: Record<number, boolean> = {};
  // A dense Lua table (extras 1..n) arrives as an array.
  const entries: Array<[number, unknown]> = Array.isArray(v)
    ? v.map((x, i) => [i + 1, x])
    : isRecord(v)
      ? Object.entries(v).map(([k, x]) => [Number(k), x])
      : [];
  for (const [id, x] of entries) {
    if (int(id, 0, 20) === null) continue;
    if (typeof x === "boolean") extras[id] = x;
    else if (x === 0 || x === 1) extras[id] = x === 0;
  }
  return extras;
}

/** Props in ox_lib / qb-core's shape turned into the lib's VehicleProps; null when it is not that shape. */
function fromFrameworkProps(v: Record<string, unknown>): VehicleProps | null {
  const model = int(v.model, -2147483648, 4294967295);
  if (model === null) return null;
  const mods: Record<number, number> = {};
  MOD_NAMES.forEach((name, type) => {
    const x = v[name];
    if (TOGGLE_MODS.has(type)) {
      if (typeof x === "boolean") mods[type] = x ? 1 : 0;
      else if (x === 0 || x === 1) mods[type] = x;
      return;
    }
    const index = int(x, -1, 255);
    if (index !== null) mods[type] = index;
  });
  const color = (x: unknown) => int(x, 0, 255);
  const neon = Array.isArray(v.neonEnabled) ? v.neonEnabled : [];
  return {
    v: 1,
    // GetEntityModel answers a signed hash on the server, Lua's joaat an unsigned one.
    model: model > 2147483647 ? model - 4294967296 : model,
    plate: typeof v.plate === "string" ? v.plate.trim().slice(0, 8) : "",
    plateIndex: int(v.plateIndex, 0, 12) ?? 0,
    colors: [color(v.color1) ?? 0, color(v.color2) ?? 0],
    extraColors: [color(v.pearlescentColor) ?? 0, color(v.wheelColor) ?? 0],
    customPrimary: rgb(v.color1),
    customSecondary: rgb(v.color2),
    wheelType: int(v.wheels, -1, 12) ?? 0,
    windowTint: int(v.windowTint, -1, 6) ?? -1,
    livery: int(v.livery, -1, 255) ?? -1,
    mods,
    xenonColor: int(v.xenonColor, -1, 255) ?? 255,
    neon: [0, 1, 2, 3].map((i) => neon[i] === true) as VehicleProps["neon"],
    neonColor: rgb(v.neonColor) ?? [255, 0, 255],
    tyreSmoke: rgb(v.tyreSmokeColor) ?? [255, 255, 255],
    extras: readExtras(v.extras),
    dirt: Math.min(15, Math.max(0, finite(v.dirtLevel, 0))),
    engineHealth: Math.min(1000, Math.max(-4000, finite(v.engineHealth, 1000))),
    bodyHealth: Math.min(1000, Math.max(0, finite(v.bodyHealth, 1000))),
  };
}

/**
 * Props a Qbox script hands to `qbx_vehicles` `SaveVehicle`: the lib's own VehicleProps, or ox_lib / qb-core's shape
 * (what Qbox garages read with `lib.getVehicleProperties`). Null when neither, or when they belong to another model than
 * the entity (the same check ai-mechanic's `SaveTuning` path makes before it saves).
 */
export function readQbxProps(
  value: unknown,
  entityModel: number,
): VehicleProps | null {
  if (!isRecord(value)) return null;
  const props = toVehicleProps(value) ?? fromFrameworkProps(value);
  return props && props.model === entityModel ? props : null;
}
