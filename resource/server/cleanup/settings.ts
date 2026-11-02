import { bool, flatDistance, int, num, record, str } from "@aifivem/lib/shared";

/** A place where a vehicle left behind goes sooner (a garage's parking area); `garage` = the garage script's id. */
export interface GarageSpot {
  garage: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface CleanupSettings {
  cleanup: boolean;
  /** "unowned": only vehicles nobody owns; "all": owned vehicles too. */
  scope: "unowned" | "all";
  abandonMs: number;
  garageMs: number;
  scanMs: number;
  /** Where a removed owned vehicle ends up. */
  ownedTo: "impound" | "garage";
  spots: GarageSpot[];
  /** Model hashes never removed. */
  blacklist: Set<number>;
  /** Vehicles a player drives are kept when nobody is near (orphan mode 2). */
  keepDriven: boolean;
  notifyGarage: boolean;
}

const spot = (garage: string, x: number, y: number, z: number) => ({
  garage,
  coords: { x, y, z },
  radius: 12,
});

/** ai-garages' public garages (real GTA parking lots). */
export const DEFAULT_SPOTS = [
  spot("pillbox", 274.29, -334.15, 44.92),
  spot("casinogarage", 883.96, -4.71, 78.76),
  spot("sapcounsel", -330.01, -780.33, 33.96),
  spot("spanishave", -1160.86, -741.41, 19.63),
  spot("caears24", 69.84, 12.6, 68.96),
  spot("caears242", -453.7, -786.78, 30.56),
  spot("lagunapi", 364.37, 297.83, 103.49),
  spot("airportp", -773.12, -2033.04, 8.88),
  spot("beachp", -1185.32, -1500.64, 4.38),
  spot("themotorhotel", 1137.77, 2663.54, 37.9),
  spot("liqourparking", 883.99, 3649.67, 32.87),
  spot("shoreparking", 1737.03, 3718.88, 34.05),
  spot("haanparking", 76.88, 6397.3, 31.23),
  spot("dumbogarage", 165.75, -3227.2, 5.89),
  spot("legion", 213.2, -796.05, 30.86),
  spot("grapeseedgarage", 2552.68, 4671.8, 33.95),
  spot("intairport", -979.06, -2995.48, 13.95),
  spot("higginsheli", -722.15, -1472.79, 5),
  spot("airsshores", 1737.89, 3288.13, 41.14),
  spot("airzancudo", -1828.25, 2975.44, 32.81),
  spot("marina", -785.95, -1497.84, -0.09),
  spot("paleto", -278.21, 6638.13, 7.55),
  spot("millars", 1298.56, 4212.42, 33.25),
  spot("dumborigparking", 161.23, -3188.73, 5.97),
  spot("popsrigparking", 137.67, 6632.99, 31.67),
  spot("ronsrigparking", -2529.37, 2342.67, 33.06),
  spot("ronsrigparking2", 2561.67, 476.68, 108.49),
  spot("ronsrigparking3", -41.24, -2550.63, 6.01),
];

const MINUTE = 60_000;

function readSpot(raw: unknown): GarageSpot | null {
  const row = record(raw);
  const coords = record(row.coords);
  if (typeof coords.x !== "number" || typeof coords.y !== "number") return null;
  return {
    garage: str(row.garage, "", 32),
    x: coords.x,
    y: coords.y,
    z: num(coords.z, 0),
    radius: num(row.radius, 12, 2, 100),
  };
}

export function readCleanupSettings(raw: unknown): CleanupSettings {
  const s = record(raw);
  const spots = Array.isArray(s.garageSpots) ? s.garageSpots : [];
  const blacklist = Array.isArray(s.blacklist) ? s.blacklist : [];
  return {
    cleanup: bool(s.cleanup, true),
    scope: s.cleanupScope === "unowned" ? "unowned" : "all",
    abandonMs: int(s.abandonMinutes, 120, 5, 1440) * MINUTE,
    garageMs: int(s.garageMinutes, 20, 1, 1440) * MINUTE,
    scanMs: int(s.scanSeconds, 15, 5, 120) * 1000,
    ownedTo: s.ownedTo === "garage" ? "garage" : "impound",
    spots: spots.flatMap((row) => readSpot(row) ?? []),
    blacklist: new Set(
      blacklist.flatMap((m) =>
        typeof m === "string" && m ? [GetHashKey(m)] : [],
      ),
    ),
    keepDriven: bool(s.keepDriven, true),
    notifyGarage: bool(s.notifyGarage, true),
  };
}

/** The garage spot a point is on (ground distance, within 10 m of height), or undefined. */
export function spotAt(
  spots: readonly GarageSpot[],
  point: { x: number; y: number; z: number },
): GarageSpot | undefined {
  return spots.find(
    (s) => flatDistance(point, s) <= s.radius && Math.abs(point.z - s.z) < 10,
  );
}
