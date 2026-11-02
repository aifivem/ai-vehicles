import { WriteQueue } from "@aifivem/lib/server";
import { normalizePlate } from "@aifivem/lib/shared";
import {
  isCustomPlate,
  plateFromId,
  type OwnedVehicle,
  type Owner,
  type PlateOwner,
  type VehicleState,
} from "common/vehicles";
import { log } from "./log";
import { ownerFeed } from "./ownerFeed";
import {
  deleteVehicle,
  fleetRows,
  fromRow,
  insertVehicle,
  maxVehicleId,
  ownerRows,
  plateRow,
  updateOwner,
  updatePlate,
  updateVehicle,
} from "./repo";

const ownerKey = (owner: Owner): string => `${owner.type}:${owner.id}`;
/**
 * Owned vehicles in memory: those of online owners (loaded at join) and every job / gang fleet (loaded at start).
 * Changes apply to memory at once and go to the database in order through one write queue; ids are assigned here,
 * so creating a vehicle is synchronous for the scripts that call it.
 */
class VehicleStore {
  private readonly byId = new Map<number, OwnedVehicle>();
  private readonly byPlate = new Map<string, number>();
  private readonly byOwner = new Map<string, Set<number>>();
  private readonly loadedOwners = new Set<string>();
  private readonly writes = new WriteQueue((label, error) =>
    log.error(`write failed (${label})`, error),
  );
  private nextId = 1;

  async init(): Promise<void> {
    const max = await maxVehicleId();
    this.nextId = Number(max ?? 0) + 1;
    const fleets = await fleetRows();
    for (const row of fleets) this.add(fromRow(row));
    for (const type of ["job", "gang"] as const)
      this.loadedOwners.add(`${type}:*`);
  }

  private add(vehicle: OwnedVehicle | null): void {
    if (!vehicle) return;
    this.byId.set(vehicle.id, vehicle);
    this.byPlate.set(vehicle.plate, vehicle.id);
    const key = ownerKey(vehicle.owner);
    let set = this.byOwner.get(key);
    if (!set) this.byOwner.set(key, (set = new Set()));
    set.add(vehicle.id);
    ownerFeed.put(vehicle);
  }

  private forget(id: number): void {
    const vehicle = this.byId.get(id);
    if (!vehicle) return;
    this.byId.delete(id);
    this.byPlate.delete(vehicle.plate);
    this.byOwner.get(ownerKey(vehicle.owner))?.delete(id);
    ownerFeed.remove(vehicle.plate);
  }

  async loadOwner(owner: Owner): Promise<void> {
    const key = ownerKey(owner);
    if (this.loadedOwners.has(key)) return;
    this.loadedOwners.add(key);
    const rows = await ownerRows(owner);
    for (const row of rows)
      if (!this.byId.has(Number(row.id))) this.add(fromRow(row));
  }

  /** Forgets an offline character's vehicles (except those still in the world). */
  unloadOwner(owner: Owner, keep: (id: number) => boolean): void {
    const key = ownerKey(owner);
    this.loadedOwners.delete(key);
    for (const id of this.byOwner.get(key) ?? [])
      if (!keep(id)) this.forget(id);
  }

  get(id: number): OwnedVehicle | undefined {
    return this.byId.get(id);
  }

  byPlateText(plate: string): OwnedVehicle | undefined {
    const id = this.byPlate.get(normalizePlate(plate));
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** Every vehicle in memory as `[plate, ownerType, ownerId]` (the `OWNERS_EVENT` mirror's snapshot). */
  plateOwners(): PlateOwner[] {
    const list: PlateOwner[] = [];
    for (const v of this.byId.values())
      list.push([v.plate, v.owner.type, v.owner.id]);
    return list;
  }

  /** A vehicle by plate, in memory or (an owner not online) from the database; not loaded into memory. */
  async findByPlate(plate: string): Promise<OwnedVehicle | null> {
    const loaded = this.byPlateText(plate);
    if (loaded) return loaded;
    const row = await plateRow(normalizePlate(plate));
    return row ? fromRow(row) : null;
  }

  /** An owner's vehicles: from memory while loaded, else from the database (not loaded into memory). */
  async ofOwnerAnywhere(owner: Owner): Promise<OwnedVehicle[]> {
    if (this.loadedOwners.has(ownerKey(owner)) || owner.type !== "character")
      return this.ofOwner(owner);
    const rows = await ownerRows(owner);
    return rows.flatMap((row) => fromRow(row) ?? []);
  }

  /**
   * Gives a vehicle in memory another plate (a custom plate, a plate changer); false when the plate is not valid, is a
   * generated one or is taken (memory and database). The entity in the world gets it too.
   */
  async setPlate(id: number, plate: string): Promise<boolean> {
    const next = normalizePlate(plate);
    const vehicle = this.byId.get(id);
    if (!vehicle || !isCustomPlate(next)) return false;
    if (next === vehicle.plate) return true;
    if (this.byPlate.has(next) || (await plateRow(next))) return false;
    // another change may have taken it meanwhile
    if (this.byPlate.has(next) || this.byId.get(id) !== vehicle) return false;
    this.byPlate.delete(vehicle.plate);
    ownerFeed.remove(vehicle.plate);
    vehicle.plate = next;
    this.byPlate.set(next, id);
    ownerFeed.put(vehicle);
    this.writes.push(`plate ${id}`, () => updatePlate(id, next));
    return true;
  }

  ofOwner(owner: Owner): OwnedVehicle[] {
    return [...(this.byOwner.get(ownerKey(owner)) ?? [])].flatMap(
      (id) => this.byId.get(id) ?? [],
    );
  }

  create(
    owner: Owner,
    model: string,
    garage: string | null,
    state: VehicleState = "garage",
    /** A free custom plate (`isCustomPlate`, checked by the caller); else the generated one. */
    plate?: string,
  ): OwnedVehicle {
    const id = this.nextId++;
    const vehicle: OwnedVehicle = {
      id,
      plate: plate ?? plateFromId(id),
      owner,
      model,
      props: null,
      setup: null,
      state,
      garage,
      fuel: 100,
      engine: 1000,
      body: 1000,
    };
    this.add(vehicle);
    this.writes.push(`create ${id}`, () =>
      insertVehicle(id, vehicle.plate, owner, model, state, garage),
    );
    return vehicle;
  }

  update(
    id: number,
    change: Partial<
      Pick<
        OwnedVehicle,
        "props" | "setup" | "state" | "garage" | "fuel" | "engine" | "body"
      >
    >,
  ): void {
    const vehicle = this.byId.get(id);
    if (!vehicle) return;
    Object.assign(vehicle, change);
    const v = { ...vehicle };
    this.writes.push(`update ${id}`, () => updateVehicle(id, v));
  }

  setOwner(id: number, owner: Owner): void {
    const vehicle = this.byId.get(id);
    if (!vehicle) return;
    this.byOwner.get(ownerKey(vehicle.owner))?.delete(id);
    vehicle.owner = owner;
    this.add(vehicle);
    this.writes.push(`owner ${id}`, () => updateOwner(id, owner));
  }

  remove(id: number): void {
    this.forget(id);
    this.writes.push(`delete ${id}`, () => deleteVehicle(id));
  }

  idle(): Promise<void> {
    return this.writes.idle();
  }
}

export const vehicles = new VehicleStore();
