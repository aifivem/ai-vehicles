import { mysql } from "@aicore-fivem/mysql";
import { toVehicleProps, toVehicleSetup } from "@aicore-fivem/lib/shared";
import type {
  OwnedVehicle,
  Owner,
  OwnerType,
  VehicleState,
} from "common/vehicles";
import { log } from "./log";

interface Row {
  id: number | string;
  plate: string;
  owner_type: string;
  owner_id: string;
  model: string;
  props: string | null;
  setup: string | null;
  state: string;
  garage: string | null;
  fuel: number;
  engine: number;
  body: number;
}

const isOwnerType = (v: string): v is OwnerType =>
  v === "character" || v === "job" || v === "gang" || v === "resource";
const isState = (v: string): v is VehicleState =>
  v === "garage" || v === "out" || v === "impound";

export function fromRow(row: Row): OwnedVehicle | null {
  if (!isOwnerType(row.owner_type)) return null;
  let props = null;
  let setup = null;
  try {
    props = row.props ? toVehicleProps(JSON.parse(row.props)) : null;
    setup = row.setup ? toVehicleSetup(JSON.parse(row.setup)) : null;
  } catch (error) {
    log.error(`vehicle ${row.id} has broken props`, error);
  }
  return {
    id: Number(row.id),
    plate: row.plate,
    owner: { type: row.owner_type, id: row.owner_id },
    model: row.model,
    props,
    setup,
    state: isState(row.state) ? row.state : "garage",
    garage: row.garage,
    fuel: row.fuel,
    engine: row.engine,
    body: row.body,
  };
}

/** The highest vehicle id in the table (new ids follow it). */
export const maxVehicleId = () =>
  mysql.scalar<number | string | null>("SELECT MAX(id) FROM ai_vehicles_owned");

/** Every job / gang / resource fleet vehicle. */
export const fleetRows = () =>
  mysql.query<Row[]>(
    "SELECT * FROM ai_vehicles_owned WHERE owner_type <> 'character'",
  );

/** One owner's vehicles. */
export const ownerRows = (owner: Owner) =>
  mysql.query<Row[]>(
    "SELECT * FROM ai_vehicles_owned WHERE owner_type = ? AND owner_id = ?",
    [owner.type, owner.id],
  );

export const insertVehicle = (
  id: number,
  plate: string,
  owner: Owner,
  model: string,
  state: VehicleState,
  garage: string | null,
) =>
  mysql.query(
    "INSERT INTO ai_vehicles_owned (id, plate, owner_type, owner_id, model, state, garage) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, plate, owner.type, owner.id, model, state, garage],
  );

export const updateVehicle = (id: number, v: OwnedVehicle) =>
  mysql.query(
    "UPDATE ai_vehicles_owned SET props = ?, setup = ?, state = ?, garage = ?, fuel = ?, engine = ?, body = ? WHERE id = ?",
    [
      v.props ? JSON.stringify(v.props) : null,
      v.setup ? JSON.stringify(v.setup) : null,
      v.state,
      v.garage,
      v.fuel,
      v.engine,
      v.body,
      id,
    ],
  );

export const updateOwner = (id: number, owner: Owner) =>
  mysql.query(
    "UPDATE ai_vehicles_owned SET owner_type = ?, owner_id = ? WHERE id = ?",
    [owner.type, owner.id, id],
  );

export const deleteVehicle = (id: number) =>
  mysql.query("DELETE FROM ai_vehicles_owned WHERE id = ?", [id]);
