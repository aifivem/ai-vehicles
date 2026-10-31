import {
  isRecord,
  toVehicleProps,
  toVehicleSetup,
} from "@aicore-fivem/lib/shared";
import type { KeyPurpose } from "@aicore-fivem/shared";
import type { OwnedVehicle, Owner, VehicleState } from "common/vehicles";
import { vehicles } from "./store";
import { world, type SpawnPoint } from "./world";

/** The API other resources use (own exports and the qbx_vehicles stand-in); every function is synchronous. */

export function toOwner(v: unknown): Owner | null {
  if (
    !isRecord(v) ||
    (v.type !== "character" &&
      v.type !== "job" &&
      v.type !== "gang" &&
      v.type !== "resource")
  )
    return null;
  const id =
    typeof v.id === "number"
      ? String(v.id)
      : typeof v.id === "string" && v.id.length <= 64
        ? v.id
        : null;
  return id ? { type: v.type, id } : null;
}

/** A vehicle by id or plate. */
export function find(ref: unknown): OwnedVehicle | undefined {
  if (typeof ref === "number") return vehicles.get(ref);
  if (typeof ref === "string") return vehicles.byPlateText(ref);
  return undefined;
}

export function createVehicle(
  owner: Owner,
  model: string,
  garage: string | null,
  props?: unknown,
  state: VehicleState = "garage",
): OwnedVehicle {
  const vehicle = vehicles.create(owner, model.toLowerCase(), garage, state);
  const parsed = toVehicleProps(props);
  if (parsed)
    vehicles.update(vehicle.id, { props: { ...parsed, plate: vehicle.plate } });
  return vehicle;
}

const clamp = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : undefined;

/**
 * Saves condition and look. Without `tuning` the stored `mods` and `neon` stay (none without stored props): only a
 * tuning shop (`SaveTuning`, ai-mechanic) changes them, so a client-read look never persists a mod menu's work. Stored
 * props end the vehicle's spawn setup (the props carry its colours now).
 */
export function saveVehicle(
  id: number,
  change: {
    props?: unknown;
    fuel?: unknown;
    engine?: unknown;
    body?: unknown;
    state?: VehicleState;
    garage?: string | null;
  },
  tuning = false,
): void {
  const vehicle = vehicles.get(id);
  if (!vehicle) return;
  const props =
    change.props === undefined ? null : toVehicleProps(change.props);
  const stored = toVehicleProps(vehicle.props);
  const fuel = clamp(change.fuel, 0, 100);
  const engine = clamp(change.engine, -4000, 1000);
  const body = clamp(change.body, 0, 1000);
  vehicles.update(id, {
    ...(props
      ? {
          props: {
            ...props,
            ...(tuning
              ? {}
              : {
                  mods: stored?.mods ?? {},
                  neon: stored?.neon ?? [false, false, false, false],
                }),
            plate: vehicle.plate,
          },
          setup: null,
        }
      : {}),
    ...(fuel !== undefined ? { fuel } : {}),
    ...(engine !== undefined ? { engine } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(change.state ? { state: change.state } : {}),
    ...(change.garage !== undefined ? { garage: change.garage } : {}),
  });
}

/**
 * Spawns the vehicle. A `setup` given to a vehicle without props is kept and applied on every spawn until its first
 * props save (a bought colour survives a vehicle that was never parked).
 */
export function spawnVehicle(
  id: number,
  at: SpawnPoint,
  asker: number,
  purpose: KeyPurpose = "garage",
  setup?: unknown,
): Promise<number | null> {
  const vehicle = vehicles.get(id);
  const parsed = setup === undefined ? null : toVehicleSetup(setup);
  if (vehicle && parsed && !vehicle.props)
    vehicles.update(id, { setup: parsed });
  return world.spawn(id, at, asker, purpose);
}

/** Parks a vehicle: out of the world, into a garage (or the impound). */
export function storeVehicle(
  id: number,
  garage: string | null,
  state: VehicleState = "garage",
): void {
  world.despawn(id);
  vehicles.update(id, { state, garage });
}
