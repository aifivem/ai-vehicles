/** ai-vehicles' contracts. No natives. */

export type {
  AdoptVehicleResult,
  DeleteByPlateResult,
  OwnedVehicle,
  VehicleOwner as Owner,
  VehicleOwnerType as OwnerType,
  VehicleState,
} from "@aifivem/shared";
export { VEHICLE_BAGS as BAGS } from "@aifivem/shared";

/** Plates come from the id (base 36, eight characters), so two vehicles never share one. */
export const plateFromId = (id: number): string =>
  `AI${id.toString(36).toUpperCase().padStart(6, "0")}`.slice(-8);

/** Generated plates (`plateFromId`) start with this: a custom plate never does, so the two never collide. */
const GENERATED = /^AI[0-9A-Z]+$/;
/** What a custom plate may be: GTA's 8 characters, letters, digits and inner spaces. */
const PLATE = /^[A-Z0-9](?:[A-Z0-9 ]{0,6}[A-Z0-9])?$/;

/** A plate a vehicle may carry besides its generated one (`SetPlate`'s rules); expects a normalized plate. */
export const isCustomPlate = (plate: string): boolean =>
  PLATE.test(plate) && !GENERATED.test(plate);

/**
 * Local server event `(puts: [plate, ownerType, ownerId][], removes: plate[])`: vehicles that entered ai-vehicles'
 * memory or changed owner, and plates that left it (one batch per tick). With the `GetPlateOwners` export (the same
 * triples, once at start) another resource mirrors plate -> owner without an export call per check.
 */
export { VEHICLES_EVENTS } from "@aifivem/shared";

export type PlateOwner = [plate: string, type: string, id: string];

/** Entity state bag: when an abandoned vehicle is removed (epoch ms); set when its driver leaves, cleared when one sits in. */
export const ABANDON_BAG = "ai:abandonAt";
