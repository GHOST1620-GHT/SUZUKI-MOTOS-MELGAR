import Link from "next/link";
import { and, count, desc, eq, gte, isNull, lt, or, sql, sum } from "drizzle-orm";
import { Coins, Percent, Repeat, UserX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { CATEGORIES, money, pts, relative, type Category } from "@/lib/format";
import { pointsByMonth, salesByMonth } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { templates, waLink } from "@/lib/whatsapp";
import { WhatsAppButton } from "@/components/client";
import { Card, LevelBadge, PageHeader, StatCard } from "@/components/ui";
import { DonutChart, HBarChart, PointsChart, SalesChart } from "@/components/charts";
import { logReminder } from "../../actions";

export const metadata = { title: "Reportes" };

export default async function Reportes({ searchParams }: { searchParams: Promise<{ meses?: string }> }) {
  await requireStaff(["ADMIN"]);
  const { meses = "12" } = await searchParams;
  const n = Math.min(24, Math.max(3, Number(meses)));
  const s = await getSettings();
  const since = new Date(new Date().getFullYear(), new Date().getMonth() - n + 1, 1);
  const inactiveLimit = new Date(Date.now() - s.inactiveDays * 86400000);

  const [sales, points, byCat, [{ total }], [{ repeat }], [mv], [bal], inactive, topRewards, byLevel, byStaff] = await Promise.all([
    salesByMonth(n),
    pointsByMonth(n),
    db.select({ cat: S.purchases.category, v: sum(S.purchases.amount), c: count() }).from(S.purchases).where(gte(S.purchases.date, since)).groupBy(S.purchases.category),
    db.select({ total: count() }).from(S.customers),
    db.select({ repeat: sql<number>`count(*)::int` }).from(sql`(select customer_id from purchases group by customer_id having count(*) > 1) t`),
    db.select({ earned: sql<number>`coalesce(sum(case when points > 0 and type <> 'DEVOLUCION' then points end),0)::int`, redeemed: sql<number>`coalesce(sum(case when type = 'CANJE' then -points end),0)::int` }).from(S.pointMovements),
    db.select({ n: sum(S.customers.pointsBalance) }).from(S.customers),
    db.query.customers.findMany({ where: and(or(lt(S.customers.lastVisitAt, inactiveLimit), isNull(S.customers.lastVisitAt)), eq(S.customers.acceptsMarketing, true)), orderBy: desc(S.customers.pointsBalance), limit: 15, with: { level: true } }),
    db.select({ name: S.rewards.name, value: count() }).from(S.redemptions).innerJoin(S.rewards, eq(S.rewards.id, S.redemptions.rewardId)).where(sql`${S.redemptions.status} <> 'CANCELADO'`).groupBy(S.rewards.name).orderBy(desc(count())).limit(8),
    db.select({ l: S.levels, n: count(S.customers.id), spend: sql<number>`coalesce(avg(${S.customers.lifetimeSpend}),0)::float`, bal: sql<number>`coalesce(sum(${S.customers.pointsBalance}),0)::int` }).from(S.levels).leftJoin(S.customers, eq(S.customers.levelId, S.levels.id)).groupBy(S.levels.id).orderBy(S.levels.minPoints),
    db.select({ name: S.users.name, value: count() }).from(S.purchases).innerJoin(S.users, eq(S.users.id, S.purchases.createdById)).where(gte(S.purchases.date, since)).groupBy(S.users.name).orderBy(desc(count())),
  ]);

  const balance = Number(bal.n ?? 0);
  const redemptionRate = mv.earned ? Math.round((mv.redeemed / mv.earned) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Reportes del programa"
        subtitle="Indicadores para medir si la fidelización está haciendo volver a los clientes."
        actions={
          <div className="flex gap-1.5">
            {["3", "6", "12", "24"].map((m) => <Link key={m} href={`?meses=${m}`} className={`chip ${String(n) === m ? "chip-active" : ""}`}>{m} meses</Link>)}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tasa de recompra" value={`${total ? Math.round((repeat / total) * 100) : 0}%`} icon={Repeat} hint={`${repeat} de ${total} clientes compraron más de una vez`} />
        <StatCard label="Tasa de canje" value={`${redemptionRate}%`} icon={Percent} tone="purple" hint={`${pts(mv.redeemed)} de ${pts(mv.earned)} puntos emitidos`} />
        <StatCard label="Pasivo en puntos" value={money(balance * s.pointValueCOP)} icon={Coins} tone="amber" hint={`${pts(balance)} pts × $${s.pointValueCOP}`} />
        <StatCard label="Clientes inactivos" value={inactive.length >= 15 ? "15+" : inactive.length} icon={UserX} tone="red" hint={`Sin compras en ${s.inactiveDays} días`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Ventas de clientes del programa" subtitle={`Últimos ${n} meses`}><SalesChart data={sales} /></Card>
        <Card title="Participación por categoría" subtitle={`Últimos ${n} meses`}>
          <DonutChart money data={byCat.map((c) => ({ name: CATEGORIES[c.cat as Category]?.label ?? c.cat, value: Math.round(Number(c.v ?? 0)), color: CATEGORIES[c.cat as Category]?.color ?? "#999" }))} />
          <div className="mt-4 space-y-2 text-sm">
            {byCat.map((c) => (
              <div key={c.cat} className="flex justify-between"><span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: CATEGORIES[c.cat as Category]?.color }} />{CATEGORIES[c.cat as Category]?.label}</span><span className="font-semibold">{money(Number(c.v ?? 0))} <span className="text-xs font-normal text-slate-400">({c.c})</span></span></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Puntos emitidos vs. canjeados"><PointsChart data={points} /></Card>
        <Card title="Premios más canjeados"><HBarChart data={topRewards} color="#7c3aed" /></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Comparativo por nivel" padded={false}>
          <table className="table">
            <thead><tr><th>Nivel</th><th className="text-right">Clientes</th><th className="text-right">Compra promedio histórica</th><th className="text-right">Puntos por canjear</th><th className="text-right">Multiplicador</th></tr></thead>
            <tbody>
              {byLevel.map(({ l, n: c, spend, bal }) => (
                <tr key={l.id}><td><LevelBadge level={l} /></td><td className="text-right">{c}</td><td className="text-right">{money(spend)}</td><td className="text-right">{pts(bal)}</td><td className="text-right">x{l.multiplier}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Compras registradas por usuario" subtitle={`Últimos ${n} meses`}><HBarChart data={byStaff} color="#0891b2" /></Card>
      </div>

      <Card className="mt-6" title="Clientes para reactivar" subtitle={`Sin compras en ${s.inactiveDays}+ días, ordenados por puntos sin usar. Una buena excusa para escribirles.`} padded={false}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Nivel</th><th className="text-right">Puntos</th><th>Última visita</th><th className="text-right">Acción</th></tr></thead>
            <tbody>
              {inactive.map((c) => {
                const msg = templates.inactive(c.firstName, c.pointsBalance, s.businessName);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/admin/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-brand-700">{c.firstName} {c.lastName}</Link><span className="block text-xs text-slate-400">{c.phone}</span></td>
                    <td><LevelBadge level={c.level} /></td>
                    <td className="text-right font-bold">{pts(c.pointsBalance)}</td>
                    <td className="text-slate-500">{relative(c.lastVisitAt)}</td>
                    <td className="text-right"><WhatsAppButton href={waLink(c.phone, msg)} onSend={logReminder.bind(null, { customerId: c.id, kind: "INACTIVO", message: msg })}>Invitar a volver</WhatsAppButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
