import { createDatabaseTables, resourceExport } from "@aicore-fivem/lib/server";
import { CORE, type CharacterInfo } from "@aicore-fivem/shared";
import { ResourceName } from "common";
import { log } from "./log";
import { vehicles } from "./store";
import { world } from "./world";
import "./exports";

const core = resourceExport("ai-core");
const characterOwner = (id: number) => ({
  type: "character" as const,
  id: String(id),
});

on(CORE.playerLoadedEvent, (_source: number, character: CharacterInfo) => {
  vehicles
    .loadOwner(characterOwner(character.id))
    .catch((error: unknown) =>
      log.error(`loading vehicles of character ${character.id} failed`, error),
    );
});
on(CORE.playerUnloadedEvent, (_source: number, charId: number) =>
  vehicles.unloadOwner(characterOwner(charId), (id) => world.has(id)),
);

createDatabaseTables(ResourceName, "sql/main.sql")
  .then(() => vehicles.init())
  .then(async () => {
    for (const source of core.GetLoadedSources()) {
      const character = core.GetCharacter(source);
      if (character) await vehicles.loadOwner(characterOwner(character.id));
    }
  })
  .catch((error: unknown) => log.error("database setup failed", error));
