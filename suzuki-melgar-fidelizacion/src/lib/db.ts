/**
 * Conexión a la base de datos.
 * - DATABASE_URL=postgres://...  → PostgreSQL real (RECOMENDADO en producción: Neon, Supabase, Railway o servidor propio)
 * - DATABASE_URL=./.data/pglite  → PostgreSQL embebido para desarrollo/demostración (un solo proceso, sin instalar nada)
 *
 * La conexión se abre de forma perezosa (en la primera consulta) para que `next build`
 * no abra la base de datos.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

function create(): DB {
  const url = process.env.DATABASE_URL ?? "./.data/pglite";
  if (url.startsWith("postgres")) {
    return drizzlePg(new Pool({ connectionString: url, max: 10 }), { schema }) as unknown as DB;
  }
  // PGlite: limpia un bloqueo huérfano si el proceso anterior se cerró de forma abrupta
  const dir = path.resolve(url);
  fs.mkdirSync(dir, { recursive: true });
  const pid = path.join(dir, "postmaster.pid");
  if (fs.existsSync(pid)) fs.rmSync(pid);
  const client = new PGlite(dir);
  g.__close = () => client.close();
  const close = () => {
    client.close().catch(() => {});
  };
  process.once("SIGINT", () => { close(); process.exit(0); });
  process.once("SIGTERM", () => { close(); process.exit(0); });
  return drizzlePglite(client, { schema }) as unknown as DB;
}

const g = globalThis as unknown as { __db?: DB; __close?: () => Promise<void> };
const get = () => (g.__db ??= create());

export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const d = get() as unknown as Record<string | symbol, unknown>;
    const v = d[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(d) : v;
  },
});
export { schema };

/** Cierra la conexión (usado por los scripts de migración y datos de ejemplo). */
export async function closeDb() {
  await g.__close?.();
}
