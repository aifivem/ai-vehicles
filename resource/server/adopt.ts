import { fuel, plateOf, registerExport } from "@aifivem/lib/server";
import { isCustomPlate, type AdoptVehicleResult } from "common/vehicles";
import { saveVehicle, toOwner } from "./api";
import { log } from "./log";
import { readAnyProps } from "./qbx/props";
import { vehicles } from "./store";
import { world } from "./world";

const fail = (error: Exclude<AdoptVehicleResult, { ok: true }>["error"]) =>
  ({ ok: false, error }) as const;
const isVehicle = (entity: number) =>
  DoesEntityExist(entity) && GetEntityType(entity) === 2;

/**
 * Makes an existing world vehicle an owned one, "out" (admin `/admincar`): the model name comes from a client and is
 * checked against the entity; the entity keeps a valid custom plate, else it gets the generated one. Refused while the
 * entity or its plate is already owned (memory and the table: an offline owner's plate too).
 */
async function adoptVehicle(
  rawOwner: unknown,
  entity: unknown,
  model: unknown,
  rawProps: unknown,
): Promise<AdoptVehicleResult> {
  const owner = toOwner(rawOwner);
  if (!owner || typeof entity !== "number" || !isVehicle(entity))
    return fail("invalid");
  const hash = GetEntityModel(entity) | 0;
  if (typeof model !== "string" || model.length > 64) return fail("model");
  if ((GetHashKey(model) | 0) !== hash) return fail("model");
  const props = readAnyProps(rawProps);
  if (!props || (props.model | 0) !== hash) return fail("invalid");
  if (world.isOwned(entity)) return fail("owned");
  const plate = plateOf(entity);
  if (plate && (await vehicles.findByPlate(plate))) return fail("plate_owned");
  // The row arrived in a socket callback: back to the game thread before any native.
  await new Promise((resolve) => setImmediate(resolve));
  // Again after the wait: the entity may be gone, or another call took it or its plate meanwhile.
  if (!isVehicle(entity)) return fail("invalid");
  if (world.isOwned(entity)) return fail("owned");
  if (plate && vehicles.byPlateText(plate)) return fail("plate_owned");
  const vehicle = vehicles.create(
    owner,
    model.toLowerCase(),
    null,
    "out",
    isCustomPlate(plate) ? plate : undefined,
  );
  const level = fuel.get(entity);
  saveVehicle(
    vehicle.id,
    {
      props,
      fuel: level ?? undefined,
      engine: props.engineHealth,
      body: props.bodyHealth,
    },
    true,
  );
  world.adopt(vehicle.id, entity);
  log.info(
    `vehicle ${vehicle.id} (${vehicle.model}, ${vehicle.plate}) adopted for ${owner.type} ${owner.id}`,
  );
  return { ok: true, id: vehicle.id, plate: vehicle.plate };
}

/** `done({ ok: true, id, plate } | { ok: false, error })`: see `AdoptVehicleResult` in `@aifivem/shared`. */
registerExport(
  "AdoptVehicle",
  (
    owner: unknown,
    entity: unknown,
    model: unknown,
    props: unknown,
    done?: unknown,
  ) => {
    const answer =
      typeof done === "function"
        ? (done as (result: AdoptVehicleResult) => void)
        : () => {};
    adoptVehicle(owner, entity, model, props).then(answer, (error: unknown) => {
      log.error("adopting a vehicle failed", error);
      answer({ ok: false, error: "failed" });
    });
  },
);
