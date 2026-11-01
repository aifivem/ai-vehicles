import { registerExport } from "@aicore-fivem/lib/server";
import { isRecord, readFinite } from "@aicore-fivem/lib/shared";
import { toKeyPurpose } from "@aicore-fivem/shared";
import type { VehicleState } from "common/vehicles";
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
registerExport("GetPlateOwners", () => vehicles.plateOwners());
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
