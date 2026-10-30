import { EntityState, setVehicleProps } from "@aicore-fivem/lib/client";
import { toVehicleProps, waitFor } from "@aicore-fivem/lib/shared";
import { BAGS } from "common/vehicles";

/**
 * Owned vehicles carry their look in a state bag; the client that owns the entity applies it (the network copies it
 * to everyone else). The bag can arrive before the entity streams in, so this waits for it.
 */
new EntityState(BAGS.props, (v) => toVehicleProps(v) ?? undefined).onChange((netId, props) => {
  if (!props) return;
  void waitFor(() => (NetworkDoesEntityExistWithNetworkId(netId) ? NetworkGetEntityFromNetworkId(netId) : undefined), 5000)
    .then((entity) => {
      if (NetworkGetEntityOwner(entity) === PlayerId()) setVehicleProps(entity, props);
    })
    .catch(() => undefined);
});
