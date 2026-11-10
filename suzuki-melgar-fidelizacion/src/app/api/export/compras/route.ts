import { and, desc, eq, gte, lte } from "drizzle-orm";
import { readSession, STAFF_COOKIE } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { CATEGORIES, type Category } from "@/lib/format";
import { xlsxResponse } from "@/lib/xlsx-response";

export async function GET(req: Request) {
  if (!(await readSession(STAFF_COOKIE))) return new Response("No autorizado", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const rows = await db
    .select({ p: S.purchases, c: S.customers })
    .from(S.purchases)
    .innerJoin(S.customers, eq(S.customers.id, S.purchases.customerId))
    .where(
      and(
        sp.get("cat") ? eq(S.purchases.category, sp.get("cat")!) : undefined,
        sp.get("origen") ? eq(S.purchases.source, sp.get("origen")!) : undefined,
        sp.get("desde") ? gte(S.purchases.date, new Date(`${sp.get("desde")}T00:00:00-05:00`)) : undefined,
        sp.get("hasta") ? lte(S.purchases.date, new Date(`${sp.get("hasta")}T23:59:59-05:00`)) : undefined,
      ),
    )
    .orderBy(desc(S.purchases.date));
  return xlsxResponse(
    rows.map(({ p, c }) => ({
      Fecha: p.date.toISOString().slice(0, 10), Factura: p.invoiceNumber ?? "", Documento: c.document, Cliente: `${c.firstName} ${c.lastName}`,
      Categoría: CATEGORIES[p.category as Category]?.label ?? p.category, "Valor (COP)": p.amount, Puntos: p.pointsEarned, Origen: p.source,
    })),
    "Compras",
    `compras-suzuki-melgar-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
