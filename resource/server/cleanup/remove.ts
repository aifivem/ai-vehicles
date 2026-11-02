import { fuel, garages } from "@aifivem/lib/server";
import { cleanupSettings } from "../content";
import { vehicles } from "../store";
import { world } from "../world";
import { spotAt } from "./settings";

/** Fuel and damage read on the server, saved before an owned vehicle leaves the world. */
function saveCondition(id: number, entity: number): void {
  const level = fuel.get(entity);
  vehicles.update(id, {
    engine: GetVehicleEngineHealth(entity),
    body: GetVehicleBodyHealth(entity),
    ...(level !== null ? { fuel: level } : {}),
  });
}

/**
 * Takes an abandoned vehicle out of the world. An owned one goes through the garage layer: into the garage of the spot
 * it stands on (setting "garage"), else to the impound; when no garage script takes it, it is deleted and lands in
 * the impound state like any owned entity that disappears (`world.removed`).
 */
export function removeAbandoned(entity: number): void {
  const id = world.idOf(entity);
  if (id !== undefined) {
    const s = cleanupSettings.value;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
    const garage =
      s.ownedTo === "garage" ? spotAt(s.spots, { x, y, z })?.garage : "";
    if (garage && garages.store(entity, garage)) return;
    if (garages.impound(entity)) return;
    saveCondition(id, entity);
  }
  DeleteEntity(entity);
}
