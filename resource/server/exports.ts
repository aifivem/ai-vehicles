import { registerExport } from "@aifivem/lib/server";
import { isRecord, readFinite, toVehicleProps } from "@aifivem/lib/shared";
import { toKeyPurpose } from "@aifivem/shared";
import type { DeleteByPlateResult, VehicleState } from "common/vehicles";
import {
  createVehicle,
  deleteVehicle,
  find,
  saveVehicle,
  spawnVehicle,
  storeVehicle,
  toOwner,
} from "./api";
import { deleteByPlate } from "./deleteByPlate";
import { log } from "./log";
import { toFrameworkProps } from "./qbx/props";
import { vehicles } from "./store";
import type { OwnedVehicle } from "common/vehicles";

/** `shape` "framework": the props in ox_lib / qb-core's shape and the fuel as `fuelLevel` (scripts written for them). */
function view(v: OwnedVehicle | null | undefined, shape: unknown) {
  if (!v) return null;
  if (shape !== "framework") return v;
  const parsed = toVehicleProps(v.props);
  const props = parsed ? toFrameworkProps(parsed) : {};
  return { ...v, props: { ...props, plate: v.plate, fuelLevel: v.fuel } };
}
import { world } from "./world";

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
registerExport("GetVehicle", (ref: unknown, shape?: unknown) =>
  view(find(ref), shape),
);
registerExport("GetVehicles", (owner: unknown, shape?: unknown) => {
  const o = toOwner(owner);
  return o ? vehicles.ofOwner(o).map((v) => view(v, shape)) : [];
});
registerExport("GetPlateOwners", () => vehicles.plateOwners());
/** A vehicle by plate, also of an owner who is not online (from the database); `done(vehicle | null)`. */
registerExport(
  "FindVehicle",
  (plate: unknown, done: unknown, shape?: unknown) => {
    if (typeof done !== "function") return;
    const answer = done as (vehicle: unknown) => void;
    if (typeof plate !== "string") return answer(null);
    void vehicles.findByPlate(plate).then(
      (v) => answer(view(v, shape)),
      () => answer(null),
    );
  },
);
/** An owner's vehicles, also of a character who is not online (from the database); `done(vehicles)`. */
registerExport(
  "GetVehiclesOf",
  (owner: unknown, done: unknown, shape?: unknown) => {
    if (typeof done !== "function") return;
    const answer = done as (list: unknown) => void;
    const o = toOwner(owner);
    if (!o) return answer([]);
    void vehicles.ofOwnerAnywhere(o).then(
      (list) => answer(list.map((v) => view(v, shape))),
      () => answer([]),
    );
  },
);
/** Another plate for a vehicle (custom plate, plate changer; the entity in the world too); `done(ok)`. */
registerExport("SetPlate", (id: unknown, plate: unknown, done?: unknown) => {
  const answer =
    typeof done === "function" ? (done as (ok: boolean) => void) : () => {};
  if (typeof id !== "number" || typeof plate !== "string") return answer(false);
  void vehicles.setPlate(id, plate).then(
    // The query resolves on Node's thread: back to the game thread before the natives.
    (ok) =>
      setImmediate(() => {
        const entity = ok ? world.entityOf(id) : undefined;
        if (entity) SetVehicleNumberPlateText(entity, plate);
        answer(ok);
      }),
    () => answer(false),
  );
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
  if (typeof id === "number") deleteVehicle(id);
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
/**
 * Deletes an owned vehicle completely by plate (row and every world entity with the plate), also of an owner who is
 * not online; `done({ ok: true, id, entities } | { ok: false, error: "invalid_plate" | "not_found" | "failed" })`.
 */
registerExport("DeleteVehicleByPlate", (plate: unknown, done?: unknown) => {
  const answer =
    typeof done === "function"
      ? (done as (result: DeleteByPlateResult) => void)
      : () => {};
  deleteByPlate(plate).then(answer, (error: unknown) => {
    log.error(`deleting plate ${String(plate)} failed`, error);
    answer({ ok: false, error: "failed" });
  });
});
