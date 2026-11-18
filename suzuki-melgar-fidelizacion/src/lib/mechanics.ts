/** Mecánicos del taller: búsqueda por nombre (sin distinguir mayúsculas/tildes) y creación automática. */
import { asc, eq, sql } from "drizzle-orm";
import { db, schema as S } from "./db";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();

/** Devuelve el id del mecánico con ese nombre; si no existe, lo crea. */
export async function resolveMechanic(name: string | null | undefined): Promise<string | null> {
  const clean = String(name ?? "").trim();
  if (!clean) return null;
  const all = await db.select().from(S.mechanics);
  const found = all.find((m) => norm(m.name) === norm(clean));
  if (found) return found.id;
  // Nombre incompleto: "NICOLAS DAVID MONTAÑA" = "Nicolas David Montaña Garzon" (si solo hay uno que coincida)
  const words = norm(clean).split(" ");
  const partial = all.filter((m) => {
    const mw = norm(m.name).split(" ");
    const [short, long] = words.length <= mw.length ? [words, mw] : [mw, words];
    return short.length >= 2 && short.every((w, i) => long[i] === w);
  });
  if (partial.length === 1) return partial[0].id;
  const [m] = await db.insert(S.mechanics).values({ name: titleCase(clean) }).onConflictDoNothing().returning();
  if (m) return m.id;
  const again = await db.select().from(S.mechanics).where(sql`lower(${S.mechanics.name}) = ${clean.toLowerCase()}`);
  return again[0]?.id ?? null;
}

export function activeMechanics() {
  return db.select().from(S.mechanics).where(eq(S.mechanics.active, true)).orderBy(asc(S.mechanics.name));
}
