import {
  provideExport,
  registerExport,
  resourceExport,
} from "@aicore-fivem/lib/server";
import { isRecord, readFinite } from "@aicore-fivem/lib/shared";
import { toKeyPurpose } from "@aicore-fivem/shared";
import type { OwnedVehicle, VehicleState } from "common/vehicles";
import {
  createVehicle,
  find,
  saveVehicle,
  spawnVehicle,
  storeVehicle,
  toOwner,
} from "./api";
import { vehicles } from "./store";
import { world } from "./world";

const core = resourceExport("ai-core");
const isState = (v: unknown): v is VehicleState =>
  v === "garage" || v === "out" || v === "impound";

/** Own exports (`exports["ai-vehicles"]`), all synchronous; spawning answers through a callback. */
registerExport(
  "CreateVehicle",
  (owner: unknown, model: unknown, garage: unknown, props: unknown) => {
    const o = toOwner(owner);
    if (!o || typeof model !== "string") return null;
    const v = createVehicle(
      o,
      model,
      typeof garage === "string" ? garage : null,
      props,
    );
    return { id: v.id, plate: v.plate };
  },
);
registerExport("GetVehicle", (ref: unknown) => find(ref) ?? null);
registerExport("GetVehicles", (owner: unknown) => {
  const o = toOwner(owner);
  return o ? vehicles.ofOwner(o) : [];
});
registerExport(
  "IsOwnedPlate",
  (plate: unknown) =>
    typeof plate === "string" && vehicles.byPlateText(plate) !== undefined,
);
registerExport("GetVehicleIdByEntity", (entity: unknown) =>
  typeof entity === "number" ? (world.idOf(entity) ?? null) : null,
);
registerExport("GetEntity", (id: unknown) =>
  typeof id === "number" ? (world.entityOf(id) ?? null) : null,
);
registerExport("SaveVehicle", (id: unknown, change: unknown) => {
  if (typeof id !== "number" || !isRecord(change)) return;
  saveVehicle(id, {
    ...change,
    state: isState(change.state) ? change.state : undefined,
    garage: typeof change.garage === "string" ? change.garage : undefined,
  });
});
registerExport("SaveTuning", (id: unknown, props: unknown) => {
  if (typeof id === "number") saveVehicle(id, { props }, true);
});
registerExport(
  "StoreVehicle",
  (id: unknown, garage: unknown, state: unknown) => {
    if (typeof id === "number")
      storeVehicle(
        id,
        typeof garage === "string" ? garage : null,
        isState(state) ? state : "garage",
      );
  },
);
registerExport("SetOwner", (id: unknown, owner: unknown) => {
  const o = toOwner(owner);
  if (typeof id === "number" && o) vehicles.setOwner(id, o);
});
registerExport("DeleteVehicle", (id: unknown) => {
  if (typeof id !== "number") return;
  world.despawn(id);
  vehicles.remove(id);
});
registerExport(
  "SpawnVehicle",
  (
    id: unknown,
    at: unknown,
    asker: unknown,
    cb: unknown,
    purpose?: unknown,
    setup?: unknown,
  ) => {
    if (typeof id !== "number" || !isRecord(at) || typeof asker !== "number")
      return;
    const [x, y, z] = [readFinite(at.x), readFinite(at.y), readFinite(at.z)];
    // A point without finite coordinates (NaN from a caller) spawns nothing.
    if (x === null || y === null || z === null) return;
    const point = {
      x,
      y,
      z,
      heading: readFinite(at.heading ?? at.w) ?? 0,
    };
    void spawnVehicle(
      id,
      point,
      asker,
      toKeyPurpose(purpose ?? "garage"),
      setup ?? undefined,
    ).then((netId) => {
      if (typeof cb === "function") cb(netId);
    });
  },
);

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
    const id = typeof entity === "number" ? world.idOf(entity) : undefined;
    if (id === undefined || !isRecord(options)) return false;
    const state =
      options.state === 1
        ? "garage"
        : options.state === 0
          ? "out"
          : options.state === 2
            ? "impound"
            : undefined;
    // Qbox scripts save the full client props on park (tuning scripts rely on it): the stand-in keeps them whole.
    saveVehicle(
      id,
      {
        props: options.props,
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
