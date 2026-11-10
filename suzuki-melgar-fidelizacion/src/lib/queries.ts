/** Consultas de reportes compartidas por el dashboard y la sección de reportes. */
import { sql } from "drizzle-orm";
import { db } from "./db";

export function rowsOf<T>(r: unknown): T[] {
  return ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return out;
}

export async function salesByMonth(n = 12) {
  const months = lastMonths(n);
  const rows = rowsOf<{ m: string; category: string; total: number; n: number }>(
    await db.execute(sql`
      select to_char(date at time zone 'America/Bogota', 'YYYY-MM') as m, category, sum(amount)::float as total, count(*)::int as n
      from purchases where date >= ${new Date(new Date().getFullYear(), new Date().getMonth() - n + 1, 1)}
      group by 1, 2`)
  );
  return months.map(({ key, label }) => {
    const r = { month: label, MOTO: 0, REPUESTOS: 0, ACCESORIOS: 0, TALLER: 0 } as Record<string, number | string>;
    for (const x of rows.filter((x) => x.m === key)) r[x.category] = x.total;
    return r as { month: string; MOTO: number; REPUESTOS: number; ACCESORIOS: number; TALLER: number };
  });
}

export async function pointsByMonth(n = 12) {
  const months = lastMonths(n);
  const rows = rowsOf<{ m: string; emitidos: number; canjeados: number; vencidos: number }>(
    await db.execute(sql`
      select to_char(created_at at time zone 'America/Bogota', 'YYYY-MM') as m,
        sum(case when points > 0 and type <> 'DEVOLUCION' then points else 0 end)::int as emitidos,
        sum(case when type = 'CANJE' then -points else 0 end)::int as canjeados,
        sum(case when type = 'VENCIMIENTO' then -points else 0 end)::int as vencidos
      from point_movements where created_at >= ${new Date(new Date().getFullYear(), new Date().getMonth() - n + 1, 1)}
      group by 1`)
  );
  return months.map(({ key, label }) => {
    const r = rows.find((x) => x.m === key);
    return { month: label, emitidos: r?.emitidos ?? 0, canjeados: r?.canjeados ?? 0, vencidos: r?.vencidos ?? 0 };
  });
}
