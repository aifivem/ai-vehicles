import { setVehicleProps } from "@aicore-fivem/lib/client";
import { toVehicleProps, waitFor } from "@aicore-fivem/lib/shared";
import { BAGS } from "common/vehicles";

/**
 * Owned vehicles carry their look in a state bag; the client that owns the entity applies it (the network copies it
 * to everyone else). The bag can arrive before the entity streams in, so this waits for it.
 */
AddStateBagChangeHandler(
  BAGS.props,
  "",
  (bagName: string, _key: string, value: unknown) => {
    const props = toVehicleProps(value);
    if (!props) return;
    void waitFor(() => {
      const entity = GetEntityFromStateBagName(bagName);
      return entity && DoesEntityExist(entity) ? entity : undefined;
    }, 5000)
      .then((entity) => {
        if (NetworkGetEntityOwner(entity) === PlayerId())
          setVehicleProps(entity, props);
      })
      .catch(() => undefined);
  },
);
