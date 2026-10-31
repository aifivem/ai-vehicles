-- Tables of this resource: CREATE TABLE IF NOT EXISTS, names prefixed with the resource (ai_<name>_...),
-- every table ending with ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;".
-- Installed by createDatabaseTables on start: missing tables and columns are added, nothing is dropped,
-- keys are only created with a new table (plan indexes before the first release).

-- Owned vehicles. `id` is assigned by the server (memory first); the plate is derived from it, so it is unique.
-- owner_type: character (owner_id = ai_core_characters.id), job or gang (owner_id = its name), resource (held by a
-- script, owner_id = the resource: a used car lot listing).
-- state: garage (in `garage`), out (in the world), impound. props: VehicleProps JSON (@aicore-fivem/lib).
-- setup: VehicleSetup JSON a vehicle spawns with until its first props save (a shop's colour).
CREATE TABLE IF NOT EXISTS `ai_vehicles_owned` (
  `id` BIGINT UNSIGNED NOT NULL,
  `plate` VARCHAR(8) NOT NULL,
  `owner_type` VARCHAR(16) NOT NULL,
  `owner_id` VARCHAR(64) NOT NULL,
  `model` VARCHAR(64) NOT NULL,
  `props` MEDIUMTEXT NULL,
  `setup` TEXT NULL,
  `state` VARCHAR(16) NOT NULL DEFAULT 'garage',
  `garage` VARCHAR(48) NULL,
  `fuel` FLOAT NOT NULL DEFAULT 100,
  `engine` FLOAT NOT NULL DEFAULT 1000,
  `body` FLOAT NOT NULL DEFAULT 1000,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plate` (`plate`),
  KEY `owner` (`owner_type`, `owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
