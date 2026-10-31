import {
  VEHICLES_EVENTS,
  type OwnedVehicle,
  type PlateOwner,
} from "common/vehicles";

/** Plate -> owner changes of the store, sent as one `VEHICLES_EVENTS.owners` batch per tick (a character's whole garage at once). */
class OwnerFeed {
  private readonly puts = new Map<string, PlateOwner>();
  private readonly removes = new Set<string>();
  private queued = false;

  put(vehicle: OwnedVehicle): void {
    this.removes.delete(vehicle.plate);
    this.puts.set(vehicle.plate, [
      vehicle.plate,
      vehicle.owner.type,
      vehicle.owner.id,
    ]);
    this.queue();
  }

  remove(plate: string): void {
    this.puts.delete(plate);
    this.removes.add(plate);
    this.queue();
  }

  private queue(): void {
    if (this.queued) return;
    this.queued = true;
    setImmediate(() => {
      this.queued = false;
      const puts = [...this.puts.values()];
      const removes = [...this.removes];
      this.puts.clear();
      this.removes.clear();
      emit(VEHICLES_EVENTS.owners, puts, removes);
    });
  }
}

export const ownerFeed = new OwnerFeed();
