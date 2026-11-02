import {
  EntityState,
  every,
  notify,
  online,
  stateNumber,
  vehicleOf,
  type Job,
} from "@aifivem/lib/server";
import { Locale } from "common";
import { ABANDON_BAG } from "common/vehicles";
import { cleanupSettings, panel } from "../content";
import { world } from "../world";
import { removeAbandoned } from "./remove";
import { spotAt } from "./settings";

/** Vehicle types never removed: a trailer belongs to a truck, a train to the track. */
const KEPT_TYPES = new Set(["trailer", "train"]);
/** When an abandoned vehicle goes (epoch ms): on the entity, so a restart of this resource keeps it. */
const abandonAt = new EntityState(ABANDON_BAG, stateNumber);

/**
 * Vehicles players leave behind. One job walks the loaded players (who drives what, which vehicles have a player
 * inside) and the vehicles waiting to go; nothing walks every vehicle after the start. A vehicle whose player driver
 * is gone gets a deadline; a driver sitting in again clears it; a vehicle with a player inside is never removed.
 */
class AbandonedVehicles {
  /** Abandoned vehicles -> deadline (epoch ms). */
  private readonly deadlines = new Map<number, number>();
  /** Vehicles a player drove at the last scan -> that driver. */
  private driven = new Map<number, number>();
  private drivenNow = new Map<number, number>();
  private readonly occupied = new Set<number>();
  private job: Job | null = null;
  private interval = 0;

  constructor() {
    for (const vehicle of GetAllVehicles() as number[]) {
      const at = abandonAt.get(vehicle);
      if (at !== undefined) this.deadlines.set(vehicle, at);
    }
    on("entityRemoved", (entity: number) => {
      this.deadlines.delete(entity);
      this.driven.delete(entity);
    });
    panel.onChange("settings", () => this.configure());
    this.configure();
  }

  /** The scan runs while the cleanup or the keeping of driven vehicles is on, at the panel's interval. */
  private configure(): void {
    const s = cleanupSettings.value;
    const active = s.cleanup || s.keepDriven;
    const interval = active ? s.scanMs : 0;
    if (interval === this.interval) return;
    this.job?.stop();
    this.interval = interval;
    this.job = active
      ? every(interval, () => this.scan(), { name: "abandoned vehicles" })
      : null;
  }

  private scan(): void {
    const s = cleanupSettings.value;
    this.readPlayers(s.keepDriven);
    if (s.cleanup) {
      const now = Date.now();
      for (const [vehicle, source] of this.driven)
        if (!this.drivenNow.has(vehicle)) this.abandoned(vehicle, source, now);
      for (const [vehicle, at] of this.deadlines)
        if (at <= now && !this.occupied.has(vehicle) && this.eligible(vehicle))
          removeAbandoned(vehicle);
    }
    [this.driven, this.drivenNow] = [this.drivenNow, this.driven];
    this.drivenNow.clear();
  }

  /** Who sits where now; a vehicle with a player driver loses its deadline and (`keep`) stays when nobody is near. */
  private readPlayers(keep: boolean): void {
    this.occupied.clear();
    for (const source of online.sources()) {
      const vehicle = vehicleOf(source);
      if (!vehicle) continue;
      this.occupied.add(vehicle);
      if (GetPedInVehicleSeat(vehicle, -1) !== GetPlayerPed(String(source)))
        continue;
      this.drivenNow.set(vehicle, source);
      if (this.deadlines.delete(vehicle)) abandonAt.set(vehicle, undefined);
      // Ambient traffic a player took: OneSync would delete it once no player is near (orphan mode 0).
      if (keep && GetEntityOrphanMode(vehicle) !== 2)
        SetEntityOrphanMode(vehicle, 2);
    }
  }

  /** The player driver left: the vehicle gets its deadline (shorter on a garage spot). */
  private abandoned(vehicle: number, driver: number, now: number): void {
    if (!DoesEntityExist(vehicle) || !this.eligible(vehicle)) return;
    const s = cleanupSettings.value;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(vehicle);
    const onSpot = spotAt(s.spots, { x, y, z }) !== undefined;
    const at = now + (onSpot ? s.garageMs : s.abandonMs);
    this.deadlines.set(vehicle, at);
    abandonAt.set(vehicle, at);
    if (onSpot && s.notifyGarage)
      notify(
        driver,
        Locale("NOTIFY_LEFT_ON_SPOT", Math.round(s.garageMs / 60_000)),
        "warning",
        8000,
      );
  }

  /** Removable now: the panel's scope, not a trailer or train, not a kept model. */
  private eligible(vehicle: number): boolean {
    const s = cleanupSettings.value;
    if (s.scope === "unowned" && world.idOf(vehicle) !== undefined)
      return false;
    if (KEPT_TYPES.has(GetVehicleType(vehicle))) return false;
    return !s.blacklist.has(GetEntityModel(vehicle));
  }
}

export const abandonedVehicles = new AbandonedVehicles();
