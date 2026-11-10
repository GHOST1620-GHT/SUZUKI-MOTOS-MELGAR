import { desc, eq } from "drizzle-orm";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, MOVEMENT_TYPES, pts } from "@/lib/format";
import { Points } from "@/components/ui";

export const metadata = { title: "Historial de puntos" };

const ICON: Record<string, string> = { COMPRA: "🛒", CANJE: "🎁", BONO: "⭐", REFERIDO: "🤝", CUMPLEANOS: "🎂", BIENVENIDA: "👋", AJUSTE: "✏️", VENCIMIENTO: "⌛", DEVOLUCION: "↩️" };

export default async function Historial() {
  const c = await requireCustomer();
  const rows = await db.select().from(S.pointMovements).where(eq(S.pointMovements.customerId, c.id)).orderBy(desc(S.pointMovements.createdAt)).limit(200);
  const earned = rows.filter((r) => r.points > 0).reduce((a, r) => a + r.points, 0);
  const spent = rows.filter((r) => r.type === "CANJE").reduce((a, r) => a - r.points, 0);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = date(r.createdAt, { month: "long", year: "numeric", timeZone: "America/Bogota" });
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Historial de puntos</h1>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-4"><p className="text-xs text-slate-500">Disponibles</p><p className="text-xl font-extrabold text-brand-800">{pts(c.pointsBalance)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Ganados</p><p className="text-xl font-extrabold text-emerald-600">{pts(earned)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Canjeados</p><p className="text-xl font-extrabold text-accent-500">{pts(spent)}</p></div>
      </div>
      {[...groups.entries()].map(([month, items]) => (
        <div key={month}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{month}</p>
          <div className="card divide-y divide-slate-100">
            {items.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">{ICON[r.type] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{r.description}</p>
                  <p className="text-xs text-slate-500">{MOVEMENT_TYPES[r.type]?.label} · {date(r.createdAt, { day: "numeric", month: "short", timeZone: "America/Bogota" })}</p>
                </div>
                <Points value={r.points} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
