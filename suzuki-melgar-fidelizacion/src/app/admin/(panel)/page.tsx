import Link from "next/link";
import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { AlertTriangle, CalendarHeart, Coins, Gift, PlusCircle, ShoppingBag, TrendingUp, UserPlus, Users, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, money, MOVEMENT_TYPES, pts, relative } from "@/lib/format";
import { maintenanceStatus } from "@/lib/loyalty";
import { pointsByMonth, salesByMonth } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, LevelBadge, PageHeader, Points, StatCard } from "@/components/ui";
import { DonutChart, PointsChart, SalesChart } from "@/components/charts";

export const metadata = { title: "Inicio" };

export default async function Dashboard() {
  const user = await requireStaff();
  const s = await getSettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const active90 = new Date(Date.now() - 90 * 86400000);

  const [[tot], [act], [bal], [mSales], [pSales], [pend], [newC], levelDist, top, recent, sales, points, motos, allBirth] = await Promise.all([
    db.select({ n: count() }).from(S.customers),
    db.select({ n: count() }).from(S.customers).where(gte(S.customers.lastVisitAt, active90)),
    db.select({ n: sum(S.customers.pointsBalance) }).from(S.customers),
    db.select({ n: sum(S.purchases.amount), c: count() }).from(S.purchases).where(gte(S.purchases.date, monthStart)),
    db.select({ n: sum(S.purchases.amount) }).from(S.purchases).where(and(gte(S.purchases.date, prevStart), sql`${S.purchases.date} < ${monthStart}`)),
    db.select({ n: count() }).from(S.redemptions).where(inArray(S.redemptions.status, ["PENDIENTE", "APROBADO"])),
    db.select({ n: count() }).from(S.customers).where(gte(S.customers.createdAt, monthStart)),
    db.select({ name: S.levels.name, color: S.levels.color, value: count(S.customers.id) }).from(S.levels).leftJoin(S.customers, eq(S.customers.levelId, S.levels.id)).groupBy(S.levels.id).orderBy(S.levels.minPoints),
    db.query.customers.findMany({ orderBy: desc(S.customers.lifetimeSpend), limit: 5, with: { level: true } }),
    db.query.pointMovements.findMany({ orderBy: desc(S.pointMovements.createdAt), limit: 8, with: { customer: true } }),
    salesByMonth(12),
    pointsByMonth(12),
    db.query.motorcycles.findMany({ with: { customer: true } }),
    db.select().from(S.customers).where(sql`${S.customers.birthDate} is not null`),
  ]);

  const maint = motos.map((m) => ({ m, st: maintenanceStatus(m, s.reminderLeadDays) }));
  const overdue = maint.filter((x) => x.st.state === "VENCIDO");
  const soon = maint.filter((x) => x.st.state === "PROXIMO");
  const dueList = [...overdue, ...soon].sort((a, b) => a.st.daysLeft - b.st.daysLeft).slice(0, 6);

  const today = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const birthdays = allBirth
    .map((c) => {
      const b = c.birthDate!;
      let next = new Date(today.getFullYear(), b.getUTCMonth(), b.getUTCDate());
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next = new Date(today.getFullYear() + 1, b.getUTCMonth(), b.getUTCDate());
      return { c, days: Math.round((next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000), next };
    })
    .filter((x) => x.days <= 7)
    .sort((a, b) => a.days - b.days);

  const monthSales = Number(mSales.n ?? 0);
  const prevSales = Number(pSales.n ?? 0);
  const delta = prevSales ? Math.round(((monthSales - prevSales) / prevSales) * 100) : 0;
  const balance = Number(bal.n ?? 0);
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      <PageHeader
        title={`${greet}, ${user.name.split(" ")[0]} 👋`}
        subtitle={`Resumen del programa de fidelización · ${date(now, { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" })}`}
        actions={
          <>
            <Link href="/admin/clientes/nuevo" className="btn btn-secondary"><UserPlus className="size-4" /> Nuevo cliente</Link>
            <Link href="/admin/compras/nueva" className="btn btn-accent"><PlusCircle className="size-4" /> Registrar compra</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes en el programa" value={pts(tot.n)} icon={Users} hint={<>{pts(act.n)} activos en 90 días · +{newC.n} este mes</>} href="/admin/clientes" />
        <StatCard label="Ventas del mes" value={money(monthSales)} icon={ShoppingBag} tone="green" hint={<span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs. mes anterior · {mSales.c} compras</span>} href="/admin/compras" />
        <StatCard label="Puntos en circulación" value={pts(balance)} icon={Coins} tone="amber" hint={`Pasivo estimado ${money(balance * s.pointValueCOP)}`} href="/admin/reportes" />
        <StatCard label="Pendientes de atender" value={`${overdue.length + pend.n}`} icon={AlertTriangle} tone="red" hint={`${overdue.length} mantenimientos vencidos · ${pend.n} canjes`} href="/admin/mantenimientos" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Ventas por categoría" subtitle="Últimos 12 meses (COP)">
          <SalesChart data={sales} />
        </Card>
        <Card title="Clientes por nivel" subtitle="Distribución actual">
          <DonutChart data={levelDist.map((l) => ({ name: l.name, value: Number(l.value), color: l.color }))} />
          <div className="mt-4 space-y-2">
            {levelDist.map((l) => (
              <div key={l.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: l.color }} /> {l.name}</span>
                <span className="font-semibold tabular-nums">{Number(l.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Wrench className="size-4 text-orange-500" /> Mantenimientos por atender</span>}
          subtitle="Contacta al cliente por WhatsApp para agendar"
          actions={<Link href="/admin/mantenimientos" className="text-sm font-semibold text-brand-700 hover:underline">Ver todos</Link>}
          padded={false}
        >
          {dueList.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Todas las motos están al día. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueList.map(({ m, st }) => (
                <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <Avatar name={`${m.customer.firstName} ${m.customer.lastName}`} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/clientes/${m.customerId}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700">{m.customer.firstName} {m.customer.lastName}</Link>
                    <p className="truncate text-xs text-slate-500">{m.model} · {m.plate ?? "sin placa"} · {pts(m.currentKm)} km</p>
                  </div>
                  {st.state === "VENCIDO" ? <Badge tone="red">Vencido {st.daysLeft < 0 ? `hace ${-st.daysLeft} d` : "por km"}</Badge> : <Badge tone="amber">En {st.daysLeft} días</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><CalendarHeart className="size-4 text-pink-500" /> Cumpleaños esta semana</span>} padded={false}>
          {birthdays.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No hay cumpleaños en los próximos 7 días.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {birthdays.map(({ c, days, next }) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xl">🎂</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/clientes/${c.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700">{c.firstName} {c.lastName}</Link>
                    <p className="text-xs text-slate-500">{date(next, { day: "numeric", month: "long" })}</p>
                  </div>
                  <Badge tone={days === 0 ? "pink" : "gray"}>{days === 0 ? "¡Hoy!" : `En ${days} d`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Puntos emitidos vs. canjeados" subtitle="Salud del programa (últimos 12 meses)">
          <PointsChart data={points} />
        </Card>
        <Card title={<span className="flex items-center gap-2"><TrendingUp className="size-4 text-emerald-500" /> Mejores clientes</span>} subtitle="Por compras históricas" padded={false}>
          <ul className="divide-y divide-slate-100">
            {top.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-4 text-sm font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/clientes/${c.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700">{c.firstName} {c.lastName}</Link>
                  <p className="text-xs text-slate-500">{money(c.lifetimeSpend)}</p>
                </div>
                <LevelBadge level={c.level} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6" title="Actividad reciente" actions={<Link href="/admin/compras" className="text-sm font-semibold text-brand-700 hover:underline">Ver compras</Link>} padded={false}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Cliente</th><th>Movimiento</th><th>Detalle</th><th className="text-right">Puntos</th><th className="text-right">Cuándo</th></tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id}>
                  <td><Link className="font-medium text-slate-800 hover:text-brand-700" href={`/admin/clientes/${m.customerId}`}>{m.customer.firstName} {m.customer.lastName}</Link></td>
                  <td><Badge tone={MOVEMENT_TYPES[m.type]?.tone}>{MOVEMENT_TYPES[m.type]?.label ?? m.type}</Badge></td>
                  <td className="max-w-xs truncate text-slate-600">{m.description}</td>
                  <td className="text-right"><Points value={m.points} /></td>
                  <td className="text-right text-slate-500 whitespace-nowrap">{relative(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/admin/canjes" className="card flex items-center gap-3 p-4 hover:shadow-md"><Gift className="size-5 text-violet-600" /><span className="text-sm font-semibold">Gestionar canjes ({pend.n} pendientes)</span></Link>
        <Link href="/admin/importar" className="card flex items-center gap-3 p-4 hover:shadow-md"><ShoppingBag className="size-5 text-cyan-600" /><span className="text-sm font-semibold">Importar ventas de MasControl</span></Link>
        <Link href="/admin/referidos" className="card flex items-center gap-3 p-4 hover:shadow-md"><UserPlus className="size-5 text-brand-700" /><span className="text-sm font-semibold">Seguimiento de referidos</span></Link>
      </div>
    </>
  );
}
