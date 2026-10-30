import { mysql } from "@aicore-fivem/mysql";
import { WriteQueue } from "@aicore-fivem/lib/server";
import { toVehicleProps, toVehicleSetup } from "@aicore-fivem/lib/shared";
import {
  plateOf,
  type OwnedVehicle,
  type Owner,
  type OwnerType,
  type VehicleState,
} from "common/vehicles";
import { log } from "./log";

interface Row {
  id: number | string;
  plate: string;
  owner_type: string;
  owner_id: string;
  model: string;
  props: string | null;
  setup: string | null;
  state: string;
  garage: string | null;
  fuel: number;
  engine: number;
  body: number;
}

const ownerKey = (owner: Owner): string => `${owner.type}:${owner.id}`;
const isOwnerType = (v: string): v is OwnerType =>
  v === "character" || v === "job" || v === "gang";
const isState = (v: string): v is VehicleState =>
  v === "garage" || v === "out" || v === "impound";

function fromRow(row: Row): OwnedVehicle | null {
  if (!isOwnerType(row.owner_type)) return null;
  let props = null;
  let setup = null;
  try {
    props = row.props ? toVehicleProps(JSON.parse(row.props)) : null;
    setup = row.setup ? toVehicleSetup(JSON.parse(row.setup)) : null;
  } catch (error) {
    log.error(`vehicle ${row.id} has broken props`, error);
  }
  return {
    id: Number(row.id),
    plate: row.plate,
    owner: { type: row.owner_type, id: row.owner_id },
    model: row.model,
    props,
    setup,
    state: isState(row.state) ? row.state : "garage",
    garage: row.garage,
    fuel: row.fuel,
    engine: row.engine,
    body: row.body,
  };
}

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
    const max = await mysql.scalar<number | string | null>(
      "SELECT MAX(id) FROM ai_vehicles_owned",
    );
    this.nextId = Number(max ?? 0) + 1;
    const fleets = await mysql.query<Row[]>(
      "SELECT * FROM ai_vehicles_owned WHERE owner_type <> 'character'",
    );
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
  }

  private forget(id: number): void {
    const vehicle = this.byId.get(id);
    if (!vehicle) return;
    this.byId.delete(id);
    this.byPlate.delete(vehicle.plate);
    this.byOwner.get(ownerKey(vehicle.owner))?.delete(id);
  }

  async loadOwner(owner: Owner): Promise<void> {
    const key = ownerKey(owner);
    if (this.loadedOwners.has(key)) return;
    this.loadedOwners.add(key);
    const rows = await mysql.query<Row[]>(
      "SELECT * FROM ai_vehicles_owned WHERE owner_type = ? AND owner_id = ?",
      [owner.type, owner.id],
    );
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
    const id = this.byPlate.get(plate.trim().toUpperCase());
    return id === undefined ? undefined : this.byId.get(id);
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
  ): OwnedVehicle {
    const id = this.nextId++;
    const vehicle: OwnedVehicle = {
      id,
      plate: plateOf(id),
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
      mysql.query(
        "INSERT INTO ai_vehicles_owned (id, plate, owner_type, owner_id, model, state, garage) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, vehicle.plate, owner.type, owner.id, model, state, garage],
      ),
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
    this.writes.push(`update ${id}`, () =>
      mysql.query(
        "UPDATE ai_vehicles_owned SET props = ?, setup = ?, state = ?, garage = ?, fuel = ?, engine = ?, body = ? WHERE id = ?",
        [
          v.props ? JSON.stringify(v.props) : null,
          v.setup ? JSON.stringify(v.setup) : null,
          v.state,
          v.garage,
          v.fuel,
          v.engine,
          v.body,
          id,
        ],
      ),
    );
  }

  setOwner(id: number, owner: Owner): void {
    const vehicle = this.byId.get(id);
    if (!vehicle) return;
    this.byOwner.get(ownerKey(vehicle.owner))?.delete(id);
    vehicle.owner = owner;
    this.add(vehicle);
    this.writes.push(`owner ${id}`, () =>
      mysql.query(
        "UPDATE ai_vehicles_owned SET owner_type = ?, owner_id = ? WHERE id = ?",
        [owner.type, owner.id, id],
      ),
    );
  }

  remove(id: number): void {
    this.forget(id);
    this.writes.push(`delete ${id}`, () =>
      mysql.query("DELETE FROM ai_vehicles_owned WHERE id = ?", [id]),
    );
  }

  idle(): Promise<void> {
    return this.writes.idle();
  }
}

export const vehicles = new VehicleStore();
