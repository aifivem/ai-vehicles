import { spawnVehicle } from "@aicore-fivem/lib/server"
import type { KeyPurpose } from "@aicore-fivem/shared"
import { BAGS } from "common/vehicles"
import { log } from "./log"
import { vehicles } from "./store"

export interface SpawnPoint {
  x: number
  y: number
  z: number
  heading: number
}

/** Owned vehicles in the world: id <-> entity. A vehicle whose entity disappears while out goes to the impound. */
class World {
  private readonly entities = new Map<number, number>()
  private readonly byEntity = new Map<number, number>()

  entityOf(id: number): number | undefined {
    const entity = this.entities.get(id)
    return entity && DoesEntityExist(entity) ? entity : undefined
  }

  idOf(entity: number): number | undefined {
    return this.byEntity.get(entity)
  }

  has(id: number): boolean {
    return this.entities.has(id)
  }

  /** Creates the vehicle (lib `spawnVehicle`), marks it with its state bags and puts it "out". */
  async spawn(
    id: number,
    at: SpawnPoint,
    asker: number,
    purpose: KeyPurpose
  ): Promise<number | null> {
    const vehicle = vehicles.get(id)
    if (!vehicle || this.entityOf(id)) return null
    const bags: Record<string, unknown> = { [BAGS.owned]: true, [BAGS.id]: id }
    if (vehicle.props)
      bags[BAGS.props] = { ...vehicle.props, plate: vehicle.plate }
    // Whoever takes it out gets the keys from the active key system (ai-vehiclekeys also knows owners by itself).
    const entity = await spawnVehicle({
      model: vehicle.model,
      coords: at,
      asker,
      plate: vehicle.plate,
      fuel: vehicle.fuel,
      bags,
      keysTo: asker,
      purpose,
    })
    if (entity === null) {
      log.error(`vehicle ${id} (${vehicle.model}) could not be created`)
      return null
    }
    this.entities.set(id, entity)
    this.byEntity.set(entity, id)
    vehicles.update(id, { state: "out", garage: null })
    return NetworkGetNetworkIdFromEntity(entity)
  }

  /** Takes the vehicle out of the world (parking); the caller sets the new state. */
  despawn(id: number): void {
    const entity = this.entities.get(id)
    this.forget(id)
    if (entity && DoesEntityExist(entity)) DeleteEntity(entity)
  }

  private forget(id: number): void {
    const entity = this.entities.get(id)
    this.entities.delete(id)
    if (entity) this.byEntity.delete(entity)
  }

  /** The game removed the entity (cleanup, crash, explosion handled elsewhere): the vehicle waits at the impound. */
  removed(entity: number): void {
    const id = this.byEntity.get(entity)
    if (id === undefined) return
    this.forget(id)
    if (vehicles.get(id)?.state === "out")
      vehicles.update(id, { state: "impound" })
  }
}

export const world = new World()

on("entityRemoved", (entity: number) => world.removed(entity))
