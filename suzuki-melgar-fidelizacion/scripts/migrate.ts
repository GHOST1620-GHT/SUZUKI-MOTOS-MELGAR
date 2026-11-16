/* Aplica las migraciones SQL de ./drizzle a la base de datos de DATABASE_URL */
import "dotenv/config";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { closeDb, db } from "../src/lib/db";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.VERCEL && !url.startsWith("postgres")) {
    throw new Error("Falta la base de datos: en Vercel vaya a Storage → Create Database → Neon y conéctela a este proyecto (crea DATABASE_URL). Luego vuelva a desplegar.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = url.startsWith("postgres") ? migratePg : migratePglite;
  await m(db, { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas ✔");
  await closeDb();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
