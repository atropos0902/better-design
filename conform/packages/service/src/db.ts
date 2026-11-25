import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import type { Env } from "./env.ts";

export type Tx = Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];

export interface Db {
  /** Run as one customer. Row security reads the setting, so a query without it sees nothing. */
  as<T>(customer: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  customerForRepo(fullName: string): Promise<string | null>;
  customerForSession(hash: string): Promise<string | null>;
}

export function connect(env: Env): Db {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error("no database configured");
  const client = postgres(url, { max: 5, prepare: false, fetch_types: false, connect_timeout: 5 });
  const db = drizzle(client);
  const one = async (q: ReturnType<typeof sql>): Promise<string | null> => {
    const rows = (await db.execute(q)) as unknown as Array<{ id: string | null }>;
    return rows[0]?.id ?? null;
  };
  return {
    as: (customer, fn) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.customer_id', ${customer}, true)`);
        return fn(tx);
      }),
    customerForRepo: (name) => one(sql`select customer_for_repo(${name}) as id`),
    customerForSession: (h) => one(sql`select customer_for_session(${h}) as id`),
  };
}
