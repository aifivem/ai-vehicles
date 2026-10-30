# ai-vehicles

Owned vehicles: storage, ownership (characters, jobs, gangs), spawning on the server and the look (props, applied by ai-core on the entity's owner client). The API garages, shops, keys and fuel build on; stands in for `qbx_vehicles`. Depends on ai-core and its table through `@aicore-fivem/mysql`.

## Decisions

- Memory first (`server/store.ts`): ids are assigned by the server (`MAX(id) + 1` at start), so `CreateVehicle` is synchronous; every change goes to the database in order through one write queue. The plate comes from the id (`AI` + base 36), so plates never collide.
- In memory: vehicles of online characters (loaded at join through lib `onCharacter`, registered once the tables and fleets are ready so its replay also loads the characters already in the game; dropped at leave unless still in the world) and every job / gang fleet (loaded at start). Exports only see those; offline characters' vehicles stay in the database.
- Spawning is lib `spawnVehicle` (server side, strict lockdown; the spawn type comes once per model from the asker's client through ai-core) with the keys for the caller's purpose (default `garage`). The entity gets the state bags `ai:owned`, `ai:vid`, `fuel` and `ai:props`; ai-core's client on the entity's owner applies the props (any resource's `spawnVehicle({ props })` works the same).
- An owned vehicle whose entity disappears while out goes to the impound state.

## Contracts

- Types and export signatures: `@aicore-fivem/shared` `vehicles.ts` (`AiVehiclesServerExports`, `VEHICLE_BAGS`).
- qbx_vehicles exports: `server/exports.ts` (citizenid filters need the owner online).
- Table `ai_vehicles_owned` (`sql/main.sql`).

## Entry points

- Store and writes: `resource/server/store.ts`; entities `server/world.ts`; API `server/api.ts`, exports `server/exports.ts`.
