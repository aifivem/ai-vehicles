/** ai-vehicles' contracts. No natives. */

export type { OwnedVehicle, VehicleOwner as Owner, VehicleOwnerType as OwnerType, VehicleState } from "@aicore-fivem/shared";
export { VEHICLE_BAGS as BAGS } from "@aicore-fivem/shared";

export const EVENTS = {
  /** Server -> client callback: (model) -> vehicle type for CreateVehicleServerSetter. */
  vehicleType: "ai-vehicles:vehicleType",
} as const;

/** Plates come from the id (base 36, eight characters), so two vehicles never share one. */
export const plateOf = (id: number): string => `AI${id.toString(36).toUpperCase().padStart(6, "0")}`.slice(-8);
