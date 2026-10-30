import { createDatabaseTables, onCharacter } from "@aicore-fivem/lib/server";
import { ResourceName } from "common";
import { log } from "./log";
import { vehicles } from "./store";
import { world } from "./world";
import "./exports";

const characterOwner = (id: number) => ({
  type: "character" as const,
  id: String(id),
});

// Owners load once the tables are ready; `onCharacter` then also loads the characters already in the game.
createDatabaseTables(ResourceName, "sql/main.sql")
  .then(() => vehicles.init())
  .then(() =>
    onCharacter({
      loaded: (_source, character) =>
        vehicles
          .loadOwner(characterOwner(character.id))
          .catch((error: unknown) =>
            log.error(
              `loading vehicles of character ${character.id} failed`,
              error,
            ),
          ),
      unloaded: (_source, charId) =>
        vehicles.unloadOwner(characterOwner(charId), (id) => world.has(id)),
    }),
  )
  .catch((error: unknown) => log.error("database setup failed", error));
