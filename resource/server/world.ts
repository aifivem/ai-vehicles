import {
  EntityState,
  fuel,
  plateOf,
  spawnVehicle,
  stateBoolean,
  stateNumber,
} from "@aifivem/lib/server";
import { toVehicleProps, toVehicleSetup } from "@aifivem/lib/shared";
import type { KeyPurpose } from "@aifivem/shared";
import { BAGS } from "common/vehicles";
import { log } from "./log";
import { vehicles } from "./store";

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  heading: number;
}

const ownedBag = new EntityState(BAGS.owned, stateBoolean);
const idBag = new EntityState(BAGS.id, stateNumber);
const propsBag = new EntityState(
  BAGS.props,
  (v) => toVehicleProps(v) ?? undefined,
);

/** Owned vehicles in the world: id <-> entity. A vehicle whose entity disappears while out goes to the impound. */
class World {
  private readonly entities = new Map<number, number>();
  private readonly byEntity = new Map<number, number>();
  /** Vehicle ids whose entity is being created. */
  private readonly spawning = new Set<number>();

  entityOf(id: number): number | undefined {
    const entity = this.entities.get(id);
    return entity && DoesEntityExist(entity) ? entity : undefined;
  }

  idOf(entity: number): number | undefined {
    return this.byEntity.get(entity);
  }

  has(id: number): boolean {
    return this.entities.has(id);
  }

  /** Creates the vehicle (lib `spawnVehicle`), marks it with its state bags and puts it "out". */
  async spawn(
    id: number,
    at: SpawnPoint,
    asker: number,
    purpose: KeyPurpose,
  ): Promise<number | null> {
    const vehicle = vehicles.get(id);
    if (!vehicle || this.entityOf(id) || this.spawning.has(id)) return null;
    // Held from here to the end of the await: a second take-out of the same car (another job member) is refused.
    this.spawning.add(id);
    try {
      return await this.create(id, vehicle, at, asker, purpose);
    } finally {
      this.spawning.delete(id);
    }
  }

  private async create(
    id: number,
    vehicle: NonNullable<ReturnType<typeof vehicles.get>>,
    at: SpawnPoint,
    asker: number,
    purpose: KeyPurpose,
  ): Promise<number | null> {
    const bags: Record<string, unknown> = { [BAGS.owned]: true, [BAGS.id]: id };
    if (vehicle.props)
      bags[BAGS.props] = { ...vehicle.props, plate: vehicle.plate };
    const setup = vehicle.props ? null : toVehicleSetup(vehicle.setup);
    // Whoever takes it out gets the keys from the active key system (ai-vehiclekeys also knows owners by itself).
    const entity = await spawnVehicle({
      model: vehicle.model,
      coords: at,
      asker,
      plate: vehicle.plate,
      fuel: vehicle.fuel,
      bags,
      ...(setup ? { setup } : {}),
      keysTo: asker,
      purpose,
    });
    if (entity === null) {
      log.error(`vehicle ${id} (${vehicle.model}) could not be created`);
      return null;
    }
    this.entities.set(id, entity);
    this.byEntity.set(entity, id);
    vehicles.update(id, { state: "out", garage: null });
    return NetworkGetNetworkIdFromEntity(entity);
  }

  /** The entity is an owned vehicle: tracked here, or marked by its bag (spawned before this resource restarted). */
  isOwned(entity: number): boolean {
    return this.byEntity.has(entity) || ownedBag.get(entity) === true;
  }

  /**
   * Makes an existing entity this vehicle, "out" (`AdoptVehicle`): the plate, orphan mode, fuel and state bags a spawn
   * gives, so it is tracked like a spawned one (impound when it disappears, garages can store it).
   */
  adopt(id: number, entity: number): void {
    const vehicle = vehicles.get(id);
    if (!vehicle || !DoesEntityExist(entity)) return;
    SetEntityOrphanMode(entity, 2);
    if (plateOf(entity) !== vehicle.plate)
      SetVehicleNumberPlateText(entity, vehicle.plate);
    fuel.set(entity, vehicle.fuel);
    ownedBag.set(entity, true);
    idBag.set(entity, id);
    const props = toVehicleProps(vehicle.props);
    if (props) propsBag.set(entity, { ...props, plate: vehicle.plate });
    this.entities.set(id, entity);
    this.byEntity.set(entity, id);
  }

  /** Takes the vehicle out of the world (parking); the caller sets the new state. */
  despawn(id: number): void {
    const entity = this.entities.get(id);
    this.forget(id);
    if (entity && DoesEntityExist(entity)) DeleteEntity(entity);
  }

  private forget(id: number): void {
    const entity = this.entities.get(id);
    this.entities.delete(id);
    if (entity) this.byEntity.delete(entity);
  }

  /** The game removed the entity (cleanup, crash, explosion handled elsewhere): the vehicle waits at the impound. */
  removed(entity: number): void {
    const id = this.byEntity.get(entity);
    if (id === undefined) return;
    this.forget(id);
    if (vehicles.get(id)?.state === "out")
      vehicles.update(id, { state: "impound" });
  }
}

export const world = new World();

on("entityRemoved", (entity: number) => world.removed(entity));
