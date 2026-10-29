import { triggerClientCallback } from "@aicore-fivem/lib/server";
import { waitFor } from "@aicore-fivem/lib/shared";
import { BAGS, EVENTS } from "common/vehicles";
import { log } from "./log";
import { vehicles } from "./store";

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/** Owned vehicles in the world: id <-> entity. A vehicle whose entity disappears while out goes to the impound. */
class World {
  private readonly entities = new Map<number, number>();
  private readonly byEntity = new Map<number, number>();
  /** Model -> CreateVehicleServerSetter type, learned once from a client. */
  private readonly types = new Map<string, string>();

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

  private async typeOf(model: string, asker: number): Promise<string> {
    const known = this.types.get(model);
    if (known) return known;
    const answer: unknown = await triggerClientCallback(EVENTS.vehicleType, asker, [model]);
    const type = typeof answer === "string" && /^[a-z]{3,12}$/.test(answer) ? answer : "automobile";
    this.types.set(model, type);
    return type;
  }

  /** Creates the vehicle on the server (strict lockdown), marks it with its state bags and puts it "out". */
  async spawn(id: number, at: SpawnPoint, asker: number): Promise<number | null> {
    const vehicle = vehicles.get(id);
    if (!vehicle || this.entityOf(id)) return null;
    const type = await this.typeOf(vehicle.model, asker);
    const entity = CreateVehicleServerSetter(GetHashKey(vehicle.model), type, at.x, at.y, at.z, at.heading);
    const exists = await waitFor(() => DoesEntityExist(entity) || undefined, 5000).catch(() => false);
    if (!exists) {
      log.error(`vehicle ${id} (${vehicle.model}) could not be created`);
      return null;
    }
    SetEntityOrphanMode(entity, 2);
    SetVehicleNumberPlateText(entity, vehicle.plate);
    const state = Entity(entity).state;
    state.set(BAGS.owned, true, true);
    state.set(BAGS.id, id, true);
    state.set(BAGS.fuel, vehicle.fuel, true);
    if (vehicle.props) state.set(BAGS.props, { ...vehicle.props, plate: vehicle.plate }, true);
    this.entities.set(id, entity);
    this.byEntity.set(entity, id);
    vehicles.update(id, { state: "out", garage: null });
    return NetworkGetNetworkIdFromEntity(entity);
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
    if (vehicles.get(id)?.state === "out") vehicles.update(id, { state: "impound" });
  }
}

export const world = new World();

on("entityRemoved", (entity: number) => world.removed(entity));
