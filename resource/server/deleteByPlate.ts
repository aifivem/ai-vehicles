import { plateOf } from "@aifivem/lib/server";
import { normalizePlate } from "@aifivem/lib/shared";
import type { DeleteByPlateResult } from "common/vehicles";
import { deleteVehicle } from "./api";
import { log } from "./log";
import { plateRow } from "./repo";
import { vehicles } from "./store";

/** Deletes every vehicle entity in the world with this plate (copies other scripts spawned too); how many. */
function deleteEntitiesWithPlate(plate: string): number {
  let count = 0;
  for (const vehicle of GetAllVehicles() as number[]) {
    if (!DoesEntityExist(vehicle) || plateOf(vehicle) !== plate) continue;
    DeleteEntity(vehicle);
    count++;
  }
  return count;
}

/**
 * Deletes an owned vehicle completely by plate (admin `/vehdel`): its row (memory first, else the table, so an
 * offline owner's vehicle too) and every world entity with that plate. Walks every vehicle once: for admin actions.
 */
export async function deleteByPlate(
  text: unknown,
): Promise<DeleteByPlateResult> {
  const plate = typeof text === "string" ? normalizePlate(text) : "";
  if (plate.length < 1 || plate.length > 8)
    return { ok: false, error: "invalid_plate" };
  let id = vehicles.byPlateText(plate)?.id;
  if (id === undefined) {
    const row = await plateRow(plate);
    if (!row) return { ok: false, error: "not_found" };
    // The row arrived in a socket callback: back to the game thread before any native.
    await new Promise((resolve) => setImmediate(resolve));
    // The owner may have joined while the row was read: memory is the truth then.
    id = vehicles.byPlateText(plate)?.id ?? Number(row.id);
  }
  deleteVehicle(id);
  const entities = deleteEntitiesWithPlate(plate);
  log.info(`vehicle ${id} (${plate}) deleted, ${entities} entities removed`);
  return { ok: true, id, entities };
}
