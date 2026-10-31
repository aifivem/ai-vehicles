# ai-vehicles

Owned vehicles: storage, ownership (characters, jobs, gangs), spawning on the server and the look (props, applied by ai-core on the entity's owner client). The API garages, shops, keys and fuel build on; stands in for `qbx_vehicles`. Depends on ai-core and its table through `@aicore-fivem/mysql`.

## Decisions

- Memory first (`server/store.ts`): ids are assigned by the server (`MAX(id) + 1` at start), so `CreateVehicle` is synchronous; every change goes to the database in order through one write queue. The plate comes from the id (`AI` + base 36), so plates never collide.
- In memory: vehicles of online characters (loaded at join through lib `onCharacter`, registered once the tables and fleets are ready so its replay also loads the characters already in the game; dropped at leave unless still in the world) and every job / gang fleet (loaded at start). Exports only see those; offline characters' vehicles stay in the database.
- Spawning is lib `spawnVehicle` (server side, strict lockdown; the spawn type comes once per model from the asker's client through ai-core) with the keys for the caller's purpose (default `garage`). The entity gets the state bags `ai:owned`, `ai:vid`, `fuel` and `ai:props`; ai-core's client on the entity's owner applies the props (any resource's `spawnVehicle({ props })` works the same).
- An owned vehicle whose entity disappears while out goes to the impound state.
- Saving is split (owner decision: only ai-mechanic changes tuning): `SaveVehicle` saves condition and look but keeps the stored `mods` and `neon` (none without stored props), so a client-read look (garage parking) never persists a mod menu; `SaveTuning` saves full props and is called only by ai-mechanic. The qbx_vehicles `SaveVehicle` stand-in saves full props, mods and neon included (owner decision: Qbox garages and tuning scripts send them and rely on them): it takes the lib's VehicleProps or ox_lib / qb-core's props shape (`server/qbxProps.ts` turns `modEngine`, `color1`, ... into VehicleProps) and, like ai-mechanic's `SaveTuning` path, refuses props whose model is not the entity's (state and garage still save); the plate is always the vehicle's own. `GetPlayerVehicle` still hands out the lib's VehicleProps shape, not ox_lib's.
- `SpawnVehicle(..., setup)` keeps a lib `VehicleSetup` (column `setup`) on a vehicle without props and applies it on every spawn until the first props save (ai-vehicleshop's colour on a vehicle that was never parked); stored props always win.

## Contracts

- Types and export signatures: `@aicore-fivem/shared` `vehicles.ts` (`AiVehiclesServerExports`, `VEHICLE_BAGS`).
- qbx_vehicles exports: `server/exports.ts` (citizenid filters need the owner online).
- Plate -> owner mirror for other resources (ai-vehiclekeys): export `GetPlateOwners()` -> `[plate, ownerType, ownerId][]` (every vehicle in memory, read once at the consumer's start) and the local server event `ai-vehicles:owners (puts, removes)` (`OWNERS_EVENT` in `resource/common/vehicles.ts`): vehicles that entered memory or changed owner as the same triples, plates that left memory; one batch per tick (`server/ownerFeed.ts`, fed by the store's add / forget). Neither is in `@aicore-fivem/shared` yet.
- Table `ai_vehicles_owned` (`sql/main.sql`).

## Entry points

- Store and writes: `resource/server/store.ts`; entities `server/world.ts`; API `server/api.ts`, exports `server/exports.ts`.
