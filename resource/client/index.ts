import { onServerCallback, setVehicleProps } from "@aicore-fivem/lib/client";
import { toVehicleProps, vehicleTypeOfClass, waitFor } from "@aicore-fivem/lib/shared";
import { BAGS, EVENTS } from "common/vehicles";

/** The server asks a client which spawn type a model is (CreateVehicleServerSetter needs it). */
onServerCallback(EVENTS.vehicleType, (model) => (typeof model === "string" ? vehicleTypeOfClass(GetVehicleClassFromName(model)) : "automobile"));

/**
 * Owned vehicles carry their look in a state bag; the client that owns the entity applies it (the network copies it
 * to everyone else). The bag can arrive before the entity streams in, so this waits for it.
 */
AddStateBagChangeHandler(BAGS.props, "", (bagName: string, _key: string, value: unknown) => {
  const props = toVehicleProps(value);
  if (!props) return;
  void waitFor(() => {
    const entity = GetEntityFromStateBagName(bagName);
    return entity && DoesEntityExist(entity) ? entity : undefined;
  }, 5000)
    .then((entity) => {
      if (NetworkGetEntityOwner(entity) === PlayerId()) setVehicleProps(entity, props);
    })
    .catch(() => undefined);
});
