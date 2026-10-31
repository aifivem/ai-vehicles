/** ai-vehicles' contracts. No natives. */

export type {
  OwnedVehicle,
  VehicleOwner as Owner,
  VehicleOwnerType as OwnerType,
  VehicleState,
} from "@aicore-fivem/shared";
export { VEHICLE_BAGS as BAGS } from "@aicore-fivem/shared";

/** Plates come from the id (base 36, eight characters), so two vehicles never share one. */
export const plateOf = (id: number): string =>
  `AI${id.toString(36).toUpperCase().padStart(6, "0")}`.slice(-8);

/**
 * Local server event `(puts: [plate, ownerType, ownerId][], removes: plate[])`: vehicles that entered ai-vehicles'
 * memory or changed owner, and plates that left it (one batch per tick). With the `GetPlateOwners` export (the same
 * triples, once at start) another resource mirrors plate -> owner without an export call per check.
 */
export { VEHICLES_EVENTS } from "@aicore-fivem/shared";

export type PlateOwner = [plate: string, type: string, id: string];
