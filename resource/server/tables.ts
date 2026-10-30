// Generated from sql/main.sql by aicore-db-types (the build runs it). Do not edit: change the SQL and build.

/** Row of each table as @aicore-fivem/mysql returns it. */
export type Tables = {
  ai_vehicles_owned: {
    id: number | string;
    plate: string;
    owner_type: string;
    owner_id: string;
    model: string;
    props: string | null;
    state: string;
    garage: string | null;
    fuel: number;
    engine: number;
    body: number;
    created_at: number;
  };
};

/** What an INSERT needs: columns with a default, NULL or AUTO_INCREMENT may be left out. */
export type TableInserts = {
  ai_vehicles_owned: {
    id: number | string;
    plate: string;
    owner_type: string;
    owner_id: string;
    model: string;
    props?: string | null;
    state?: string;
    garage?: string | null;
    fuel?: number;
    engine?: number;
    body?: number;
    created_at?: number;
  };
};
