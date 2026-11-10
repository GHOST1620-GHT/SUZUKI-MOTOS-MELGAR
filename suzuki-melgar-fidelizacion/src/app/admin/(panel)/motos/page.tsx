import Link from "next/link";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { Bike, Search } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts } from "@/lib/format";
import { maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { HBarChart } from "@/components/charts";

export const metadata = { title: "Motos" };

export default async function Motos({ searchParams }: { searchParams: Promise<{ q?: string; modelo?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const s = await getSettings();
  const like = sp.q ? `%${sp.q}%` : null;
  const rows = await db
    .select({ m: S.motorcycles, c: { id: S.customers.id, firstName: S.customers.firstName, lastName: S.customers.lastName, phone: S.customers.phone } })
    .from(S.motorcycles)
    .innerJoin(S.customers, eq(S.customers.id, S.motorcycles.customerId))
    .where(
      and(
        like ? or(ilike(S.motorcycles.plate, like), ilike(S.motorcycles.model, like), ilike(S.motorcycles.vin, like), ilike(sql`${S.customers.firstName} || ' ' || ${S.customers.lastName}`, like)) : undefined,
        sp.modelo ? eq(S.motorcycles.model, sp.modelo) : undefined,
      ),
    )
    .orderBy(S.motorcycles.model);
  const byModel = (await db.select({ name: S.motorcycles.model, value: sql<number>`count(*)::int` }).from(S.motorcycles).groupBy(S.motorcycles.model).orderBy(sql`2 desc`)).slice(0, 10);

  return (
    <>
      <PageHeader title="Parque de motos" subtitle={`${rows.length} motos registradas de clientes del programa`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <form className="flex gap-2 border-b border-slate-100 p-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={sp.q} className="input pl-9" placeholder="Placa, modelo, VIN o propietario…" />
            </div>
            <button className="btn btn-primary">Buscar</button>
            {(sp.q || sp.modelo) && <Link href="/admin/motos" className="btn btn-ghost">Limpiar</Link>}
          </form>
          {rows.length === 0 ? <EmptyState icon={Bike} title="No se encontraron motos" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Placa</th><th>Moto</th><th>Propietario</th><th className="text-right">Km</th><th>Compra</th><th>Mantenimiento</th></tr></thead>
                <tbody>
                  {rows.map(({ m, c }) => {
                    const st = maintenanceStatus(m, s.reminderLeadDays);
                    return (
                      <tr key={m.id}>
                        <td><span className="rounded border-2 border-slate-800 bg-yellow-300 px-1.5 font-mono text-xs font-bold">{m.plate ?? "S/P"}</span></td>
                        <td><span className="font-medium">{m.brand} {m.model}</span><span className="block text-xs text-slate-400">{[m.year, m.color].filter(Boolean).join(" · ")}</span></td>
                        <td><Link href={`/admin/clientes/${c.id}`} className="text-slate-700 hover:text-brand-700">{c.firstName} {c.lastName}</Link><span className="block text-xs text-slate-400">{c.phone}</span></td>
                        <td className="text-right tabular-nums">{pts(m.currentKm)}</td>
                        <td className="text-slate-500">{date(m.purchaseDate)}</td>
                        <td>{st.state === "VENCIDO" ? <Badge tone="red">Vencido</Badge> : st.state === "PROXIMO" ? <Badge tone="amber">Próximo</Badge> : <Badge tone="green">Al día</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Modelos más vendidos" subtitle="Motos de clientes del programa">
          <HBarChart data={byModel} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {byModel.map((b) => <Link key={b.name} href={`/admin/motos?modelo=${encodeURIComponent(b.name)}`} className={`chip ${sp.modelo === b.name ? "chip-active" : ""}`}>{b.name}</Link>)}
          </div>
        </Card>
      </div>
    </>
  );
}
