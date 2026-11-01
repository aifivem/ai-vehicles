import { provideExport, resourceExport } from "@aicore-fivem/lib/server";
import { isRecord } from "@aicore-fivem/lib/shared";
import type { OwnedVehicle } from "common/vehicles";
import { createVehicle, find, saveVehicle } from "../api";
import { vehicles } from "../store";
import { world } from "../world";
import { readQbxProps } from "./props";

const core = resourceExport("ai-core");

/** qbx_vehicles (`provide qbx_vehicles`): the shape Qbox scripts read. citizenid filters need the owner online. */
function qbxView(v: OwnedVehicle) {
  const source =
    v.owner.type === "character"
      ? core.GetSourceByCharId(Number(v.owner.id))
      : null;
  const citizenid =
    source !== null ? (core.GetCharacter(source)?.citizenid ?? null) : null;
  return {
    id: v.id,
    citizenid,
    modelName: v.model,
    garage: v.garage,
    state: v.state === "garage" ? 1 : v.state === "out" ? 0 : 2,
    depotPrice: 0,
    props: v.props ?? {},
  };
}

function charIdOf(citizenid: unknown): string | null {
  if (typeof citizenid !== "string") return null;
  const source = core.GetSourceByCitizenId(citizenid);
  const id = source !== null ? core.GetCharacter(source)?.id : undefined;
  return id === undefined ? null : String(id);
}

const qbx: Record<string, (...args: unknown[]) => unknown> = {
  GetPlayerVehicles: (filters) => {
    const charId = isRecord(filters) ? charIdOf(filters.citizenid) : null;
    const list = charId
      ? vehicles.ofOwner({ type: "character", id: charId })
      : [];
    const garage =
      isRecord(filters) && typeof filters.garage === "string"
        ? filters.garage
        : null;
    return list.filter((v) => !garage || v.garage === garage).map(qbxView);
  },
  GetPlayerVehicle: (id) => {
    const v = typeof id === "number" ? vehicles.get(id) : undefined;
    return v ? qbxView(v) : null;
  },
  CreatePlayerVehicle: (request) => {
    if (!isRecord(request) || typeof request.model !== "string")
      return [null, { code: "bad_request", message: "model missing" }];
    const charId = charIdOf(request.citizenid);
    if (!charId)
      return [null, { code: "not_found", message: "owner not online" }];
    return createVehicle(
      { type: "character", id: charId },
      request.model,
      typeof request.garage === "string" ? request.garage : null,
      request.props,
    ).id;
  },
  SetPlayerVehicleOwner: (id, citizenid) => {
    const charId = charIdOf(citizenid);
    if (typeof id !== "number" || !charId) return false;
    vehicles.setOwner(id, { type: "character", id: charId });
    return true;
  },
  DeletePlayerVehicles: (idType, idValue) => {
    const v =
      idType === "plate"
        ? find(idValue)
        : idType === "vehicleId"
          ? find(Number(idValue))
          : undefined;
    if (!v) return false;
    world.despawn(v.id);
    vehicles.remove(v.id);
    return true;
  },
  GetVehicleIdByPlate: (plate) => find(plate)?.id ?? null,
  DoesPlayerVehiclePlateExist: (plate) =>
    typeof plate === "string" && vehicles.byPlateText(plate) !== undefined,
  SaveVehicle: (entity, options) => {
    const handle = typeof entity === "number" ? entity : 0;
    const id = world.idOf(handle);
    if (id === undefined || !isRecord(options)) return false;
    const state =
      options.state === 1
        ? "garage"
        : options.state === 0
          ? "out"
          : options.state === 2
            ? "impound"
            : undefined;
    // Qbox scripts save the full client props on park, mods included (owner decision: kept, tuning scripts rely on
    // it). Ours or ox_lib / qb-core's shape, refused when they belong to another model than the entity.
    const props =
      options.props == null
        ? undefined
        : (readQbxProps(options.props, GetEntityModel(handle)) ?? undefined);
    saveVehicle(
      id,
      {
        props,
        state,
        garage: typeof options.garage === "string" ? options.garage : undefined,
      },
      true,
    );
    return true;
  },
};
for (const [name, fn] of Object.entries(qbx))
  provideExport("qbx_vehicles", name, fn);
