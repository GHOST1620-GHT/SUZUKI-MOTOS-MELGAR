import { desc } from "drizzle-orm";
import { readSession, STAFF_COOKIE } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { xlsxResponse } from "@/lib/xlsx-response";

export async function GET() {
  if (!(await readSession(STAFF_COOKIE))) return new Response("No autorizado", { status: 401 });
  const rows = await db.query.customers.findMany({ orderBy: desc(S.customers.lifetimeSpend), with: { level: true, motorcycles: true } });
  return xlsxResponse(
    rows.map((c) => ({
      "Tipo doc": c.documentType, Documento: c.document, Nombres: c.firstName, Apellidos: c.lastName, Celular: c.phone, Correo: c.email ?? "",
      Ciudad: c.city ?? "", Nivel: c.level?.name ?? "", "Puntos disponibles": c.pointsBalance, "Puntos históricos": c.lifetimePoints,
      "Compras totales (COP)": c.lifetimeSpend, Motos: c.motorcycles.map((m) => `${m.model} ${m.plate ?? ""}`).join(" | "),
      "Última visita": c.lastVisitAt?.toISOString().slice(0, 10) ?? "", "Cliente desde": c.createdAt.toISOString().slice(0, 10),
      "Portal activo": c.passwordHash ? "Sí" : "No", "Acepta promociones": c.acceptsMarketing ? "Sí" : "No", "Código referido": c.referralCode,
    })),
    "Clientes",
    `clientes-suzuki-melgar-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
