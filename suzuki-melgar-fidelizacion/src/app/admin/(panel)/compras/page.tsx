import Link from "next/link";
import { and, count, desc, eq, gte, ilike, lte, or, sql, sum, type SQL } from "drizzle-orm";
import { Download, PlusCircle, Receipt } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { CATEGORIES, date, money, pts, type Category } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Pagination, Points, StatCard } from "@/components/ui";
import { Coins, ShoppingBag, TrendingUp } from "lucide-react";

export const metadata = { title: "Compras y puntos" };
const PER = 25;

export default async function Compras({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p ?? 1));
  const where: (SQL | undefined)[] = [];
  if (sp.cat) where.push(eq(S.purchases.category, sp.cat));
  if (sp.origen) where.push(eq(S.purchases.source, sp.origen));
  if (sp.desde) where.push(gte(S.purchases.date, new Date(`${sp.desde}T00:00:00-05:00`)));
  if (sp.hasta) where.push(lte(S.purchases.date, new Date(`${sp.hasta}T23:59:59-05:00`)));
  if (sp.q) {
    const like = `%${sp.q}%`;
    where.push(or(ilike(S.purchases.invoiceNumber, like), ilike(sql`${S.customers.firstName} || ' ' || ${S.customers.lastName}`, like), ilike(S.customers.document, like)));
  }
  const w = and(...where);

  const [[tot], rows] = await Promise.all([
    db.select({ n: count(), amount: sum(S.purchases.amount), points: sum(S.purchases.pointsEarned) }).from(S.purchases).innerJoin(S.customers, eq(S.customers.id, S.purchases.customerId)).where(w),
    db
      .select({ p: S.purchases, c: { id: S.customers.id, firstName: S.customers.firstName, lastName: S.customers.lastName, document: S.customers.document }, u: { name: S.users.name } })
      .from(S.purchases)
      .innerJoin(S.customers, eq(S.customers.id, S.purchases.customerId))
      .leftJoin(S.users, eq(S.users.id, S.purchases.createdById))
      .where(w)
      .orderBy(desc(S.purchases.date))
      .limit(PER)
      .offset((page - 1) * PER),
  ]);
  const pages = Math.ceil(tot.n / PER);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/compras${p.size ? `?${p}` : ""}`;
  };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "p") as [string, string][]);

  return (
    <>
      <PageHeader
        title="Compras y puntos"
        subtitle="Todas las compras registradas manualmente, importadas de MasControl o recibidas por API."
        actions={
          <>
            <a href={`/api/export/compras?${exportQs}`} className="btn btn-secondary"><Download className="size-4" /> Exportar</a>
            <Link href="/admin/compras/nueva" className="btn btn-accent"><PlusCircle className="size-4" /> Registrar compra</Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Compras (filtro actual)" value={pts(tot.n)} icon={ShoppingBag} />
        <StatCard label="Valor total" value={money(Number(tot.amount ?? 0))} icon={TrendingUp} tone="green" hint={tot.n ? `Ticket promedio ${money(Number(tot.amount ?? 0) / tot.n)}` : undefined} />
        <StatCard label="Puntos otorgados" value={pts(Number(tot.points ?? 0))} icon={Coins} tone="amber" />
      </div>
      <Card padded={false}>
        <form className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-6" action="/admin/compras">
          <input name="q" defaultValue={sp.q} className="input md:col-span-2" placeholder="Factura, cliente o cédula…" />
          <select name="cat" defaultValue={sp.cat ?? ""} className="input">
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select name="origen" defaultValue={sp.origen ?? ""} className="input">
            <option value="">Todo origen</option><option value="MANUAL">Manual</option><option value="IMPORTACION">Importación MasControl</option><option value="API">API</option>
          </select>
          <div className="flex gap-2 md:col-span-2">
            <input type="date" name="desde" defaultValue={sp.desde} className="input" title="Desde" />
            <input type="date" name="hasta" defaultValue={sp.hasta} className="input" title="Hasta" />
            <button className="btn btn-primary">Filtrar</button>
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No hay compras con estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Categoría</th><th className="text-right">Valor</th><th className="text-right">Puntos</th><th>Origen</th><th>Registró</th></tr></thead>
              <tbody>
                {rows.map(({ p, c, u }) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap text-slate-500">{date(p.date)}</td>
                    <td className="font-mono text-xs">{p.invoiceNumber ?? "—"}</td>
                    <td><Link href={`/admin/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-brand-700">{c.firstName} {c.lastName}</Link><span className="block text-xs text-slate-400">CC {c.document}</span></td>
                    <td><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: CATEGORIES[p.category as Category]?.color }} />{CATEGORIES[p.category as Category]?.label}</span></td>
                    <td className="text-right tabular-nums">{money(p.amount)}</td>
                    <td className="text-right"><Points value={p.pointsEarned} /></td>
                    <td><Badge tone={p.source === "MANUAL" ? "gray" : "blue"}>{p.source === "IMPORTACION" ? "MasControl" : p.source === "API" ? "API" : "Manual"}</Badge></td>
                    <td className="text-xs text-slate-500">{u?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} makeHref={(p) => qs({ p: String(p) })} />
      </Card>
    </>
  );
}
