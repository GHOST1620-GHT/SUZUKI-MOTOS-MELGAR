import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { Award, Edit3, Medal, Plus, Trophy, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, money, pts } from "@/lib/format";
import { Modal, SubmitButton } from "@/components/client";
import { HBarChart, StackedBarChart } from "@/components/charts";
import { Badge, Card, EmptyState, Field, PageHeader, StatCard } from "@/components/ui";
import { saveMechanic } from "../../actions";

export const metadata = { title: "Mecánicos" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAY = 86400000;
const serv = (n: number) => `${pts(n)} ${n === 1 ? "servicio" : "servicios"}`;

/** Fecha de hoy en Bogotá (año, mes 0-11, día). */
function today() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = p.split("-").map(Number);
  return { y, m: m - 1, d };
}
/** Inicio del día (00:00 hora Colombia) como Date. */
const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 5, 0, 0));
const ymd = (dt: Date) => new Date(dt.getTime() - 5 * 3600000).toISOString().slice(0, 10);

type Period = { key: string; label: string; from: Date; to: Date; bucket: "day" | "month" };

function getPeriod(key: string, desde?: string, hasta?: string): Period {
  const t = today();
  const startToday = at(t.y, t.m, t.d);
  const dow = (new Date(Date.UTC(t.y, t.m, t.d)).getUTCDay() + 6) % 7; // lunes = 0
  switch (key) {
    case "hoy":
      return { key, label: "Hoy", from: startToday, to: new Date(startToday.getTime() + DAY), bucket: "day" };
    case "semana": {
      const from = new Date(startToday.getTime() - dow * DAY);
      return { key, label: "Esta semana", from, to: new Date(from.getTime() + 7 * DAY), bucket: "day" };
    }
    case "mesant":
      return { key, label: `${MONTHS[(t.m + 11) % 12]} (mes anterior)`, from: at(t.y, t.m - 1, 1), to: at(t.y, t.m, 1), bucket: "day" };
    case "anio":
      return { key, label: `Año ${t.y}`, from: at(t.y, 0, 1), to: at(t.y + 1, 0, 1), bucket: "month" };
    case "rango": {
      const f = desde ? new Date(`${desde}T00:00:00-05:00`) : at(t.y, t.m, 1);
      const h = hasta ? new Date(new Date(`${hasta}T00:00:00-05:00`).getTime() + DAY) : new Date(startToday.getTime() + DAY);
      return { key, label: `${date(f)} – ${date(new Date(h.getTime() - DAY))}`, from: f, to: h, bucket: h.getTime() - f.getTime() > 62 * DAY ? "month" : "day" };
    }
    default:
      return { key: "mes", label: `${MONTHS[t.m]} ${t.y}`, from: at(t.y, t.m, 1), to: at(t.y, t.m + 1, 1), bucket: "day" };
  }
}

async function servicesBetween(from: Date, to: Date) {
  return db
    .select({ id: S.purchases.id, mechanicId: S.purchases.mechanicId, amount: S.purchases.amount, date: S.purchases.date })
    .from(S.purchases)
    .where(and(eq(S.purchases.category, "TALLER"), gte(S.purchases.date, from), lt(S.purchases.date, to)));
}

type Row = { id: string; name: string; services: number; amount: number; last: Date | null };

function rank(rows: Awaited<ReturnType<typeof servicesBetween>>, names: Map<string, string>) {
  const map = new Map<string, Row>();
  for (const r of rows) {
    if (!r.mechanicId) continue;
    const cur = map.get(r.mechanicId) ?? { id: r.mechanicId, name: names.get(r.mechanicId) ?? "—", services: 0, amount: 0, last: null };
    cur.services++;
    cur.amount += r.amount;
    if (!cur.last || r.date > cur.last) cur.last = r.date;
    map.set(r.mechanicId, cur);
  }
  return [...map.values()].sort((a, b) => b.services - a.services || b.amount - a.amount);
}

export default async function Mecanicos({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string; ver?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const period = getPeriod(sp.p ?? "mes", sp.desde, sp.hasta);
  const by = sp.ver === "valor" ? "valor" : "servicios";
  const t = today();

  const [mechanics, rows, monthRows, prevRows] = await Promise.all([
    db.select().from(S.mechanics).orderBy(asc(S.mechanics.name)),
    servicesBetween(period.from, period.to),
    servicesBetween(at(t.y, t.m, 1), at(t.y, t.m + 1, 1)),
    servicesBetween(at(t.y, t.m - 1, 1), at(t.y, t.m, 1)),
  ]);
  const names = new Map(mechanics.map((m) => [m.id, m.name]));
  const ranking = rank(rows, names);
  const monthRanking = rank(monthRows, names);
  const prevWinner = rank(prevRows, names)[0];
  const winner = monthRanking[0];
  const unassigned = rows.filter((r) => !r.mechanicId).length;
  const totalServices = ranking.reduce((a, r) => a + r.services, 0);
  const totalAmount = ranking.reduce((a, r) => a + r.amount, 0);
  const canEdit = user.role === "ADMIN" || user.role === "TALLER";

  // Evolución: por día (o por mes en rangos largos), una línea por mecánico (los 6 primeros)
  const top = ranking.slice(0, 6);
  const buckets: { key: string; label: string }[] = [];
  if (period.bucket === "day") {
    for (let d = period.from.getTime(); d < period.to.getTime(); d += DAY) {
      const k = ymd(new Date(d));
      buckets.push({ key: k, label: `${Number(k.slice(8))}/${Number(k.slice(5, 7))}` });
    }
  } else {
    const f = new Date(period.from.getTime() - 5 * 3600000);
    for (let y = f.getUTCFullYear(), m = f.getUTCMonth(); at(y, m, 1) < period.to; m++) {
      const dt = new Date(Date.UTC(y, m, 1));
      buckets.push({ key: dt.toISOString().slice(0, 7), label: `${MONTHS[dt.getUTCMonth()].slice(0, 3)} ${String(dt.getUTCFullYear()).slice(2)}` });
    }
  }
  const trend = buckets.map((b) => {
    const o: Record<string, string | number> = { label: b.label };
    for (const m of top) {
      const inB = rows.filter((r) => r.mechanicId === m.id && (period.bucket === "day" ? ymd(r.date) === b.key : ymd(r.date).slice(0, 7) === b.key));
      o[m.name] = by === "valor" ? inB.reduce((a, r) => a + r.amount, 0) : inB.length;
    }
    return o;
  });

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/mecanicos${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Mecánicos del taller"
        subtitle="Ranking por servicios de taller realizados y valor facturado. Solo cuentan las compras de categoría Taller con mecánico asignado."
        actions={
          canEdit && (
            <Modal title="Agregar mecánico" trigger={<><Plus className="size-4" /> Agregar mecánico</>}>
              <form action={saveMechanic} className="space-y-4">
                <Field label="Nombre completo"><input name="name" required className="input" placeholder="Ej: Jhon Fredy Ramírez" /></Field>
                <p className="text-xs text-slate-500">También se crean solos al importar la plantilla con la columna Mecánico.</p>
                <div className="flex justify-end"><SubmitButton>Agregar</SubmitButton></div>
              </form>
            </Modal>
          )
        }
      />

      {/* Mecánico del mes */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-6 text-white shadow-lg lg:col-span-2">
          <Trophy className="pointer-events-none absolute -right-4 -top-4 size-40 text-yellow-300/15" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">Mecánico del mes · {MONTHS[t.m]} {t.y}</p>
          {winner ? (
            <>
              <p className="mt-2 text-3xl font-extrabold">{winner.name}</p>
              <p className="mt-1 text-brand-100">
                <b className="text-white">{serv(winner.services)}</b> · {money(winner.amount)} facturados
              </p>
              {monthRanking[1] && (
                <p className="mt-4 text-sm text-brand-100">
                  Le sigue {monthRanking[1].name} con {serv(monthRanking[1].services)}
                  {winner.services === monthRanking[1].services ? " (empate en servicios; gana por valor facturado)" : ""}.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-brand-100">Aún no hay servicios de taller con mecánico asignado este mes.</p>
          )}
        </div>
        <div className="card flex flex-col justify-center p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500"><Award className="size-4 text-amber-500" /> Ganador de {MONTHS[(t.m + 11) % 12]}</p>
          {prevWinner ? (
            <>
              <p className="mt-1 text-xl font-bold text-slate-900">{prevWinner.name}</p>
              <p className="text-sm text-slate-500">{serv(prevWinner.services)} · {money(prevWinner.amount)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Sin datos del mes anterior.</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <span className="text-xs font-medium text-slate-500">Período:</span>
          {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mesant", "Mes anterior"], ["anio", "Este año"]].map(([k, l]) => (
            <Link key={k} href={qs({ p: k, desde: undefined, hasta: undefined })} className={`chip ${period.key === k ? "chip-active" : ""}`}>{l}</Link>
          ))}
          <form action="/admin/mecanicos" className="flex items-center gap-1.5">
            <input type="hidden" name="p" value="rango" />
            {sp.ver && <input type="hidden" name="ver" value={sp.ver} />}
            <input type="date" name="desde" defaultValue={sp.desde} className="input py-1 text-xs" title="Desde" />
            <input type="date" name="hasta" defaultValue={sp.hasta} className="input py-1 text-xs" title="Hasta" />
            <button className={`chip whitespace-nowrap ${period.key === "rango" ? "chip-active" : ""}`}>Ver rango</button>
          </form>
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            Medir por:
            <Link href={qs({ ver: undefined })} className={`chip ${by === "servicios" ? "chip-active" : ""}`}>Servicios</Link>
            <Link href={qs({ ver: "valor" })} className={`chip ${by === "valor" ? "chip-active" : ""}`}>Valor facturado</Link>
          </span>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={`Servicios · ${period.label}`} value={pts(totalServices)} icon={Wrench} tone="amber" hint={unassigned ? `${unassigned} sin mecánico asignado` : "Todos con mecánico asignado"} />
        <StatCard label="Valor facturado en taller" value={money(totalAmount)} icon={Medal} tone="green" hint={totalServices ? `Promedio ${money(totalAmount / totalServices)} por servicio` : undefined} />
        <StatCard label="Mecánicos con servicios" value={`${ranking.length} de ${mechanics.filter((m) => m.active).length}`} icon={Trophy} tone="blue" />
      </div>

      {ranking.length === 0 ? (
        <Card><EmptyState icon={Wrench} title={`Sin servicios con mecánico en: ${period.label}`} text="Asigne el mecánico al registrar servicios de taller, o incluya la columna Mecánico en la plantilla de importación." /></Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-2" title={by === "valor" ? "Valor facturado por mecánico" : "Servicios por mecánico"} subtitle={period.label}>
              <HBarChart data={[...ranking].sort((a, b) => (by === "valor" ? b.amount - a.amount : b.services - a.services)).map((r) => ({ name: r.name, value: by === "valor" ? r.amount : r.services }))} money={by === "valor"} color={by === "valor" ? "#059669" : "#1a3fc0"} />
            </Card>
            <Card className="xl:col-span-3" title={`Evolución ${period.bucket === "day" ? "por día" : "por mes"}`} subtitle={`${by === "valor" ? "Valor facturado" : "Servicios"} · ${top.length < ranking.length ? `los ${top.length} primeros` : "todos los mecánicos"}`}>
              <StackedBarChart data={trend} series={top.map((m) => m.name)} money={by === "valor"} />
            </Card>
          </div>

          <Card className="mt-6" title="Tabla de posiciones" subtitle={period.label} padded={false}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>#</th><th>Mecánico</th><th className="text-right">Servicios</th><th className="text-right">Valor facturado</th><th className="text-right">Promedio</th><th>Participación</th><th>Último servicio</th></tr></thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const share = totalServices ? Math.round((r.services / totalServices) * 100) : 0;
                    return (
                      <tr key={r.id}>
                        <td className="text-lg">{["🥇", "🥈", "🥉"][i] ?? <span className="text-sm text-slate-400">{i + 1}</span>}</td>
                        <td className="font-semibold text-slate-800">{r.name}</td>
                        <td className="text-right font-bold tabular-nums">{pts(r.services)}</td>
                        <td className="text-right tabular-nums">{money(r.amount)}</td>
                        <td className="text-right tabular-nums text-slate-600">{money(r.amount / r.services)}</td>
                        <td className="w-40">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600" style={{ width: `${share}%` }} /></div>
                            <span className="w-9 text-right text-xs text-slate-500">{share}%</span>
                          </div>
                        </td>
                        <td className="text-slate-500">{date(r.last)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Lista de mecánicos */}
      <Card className="mt-6" title="Lista de mecánicos" subtitle="Los inactivos no aparecen al registrar servicios, pero conservan su historial." padded={false}>
        {mechanics.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Aún no hay mecánicos registrados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mechanics.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">{m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <span className="flex-1 text-sm font-medium text-slate-800">{m.name}</span>
                {!m.active && <Badge>Inactivo</Badge>}
                {canEdit && (
                  <Modal title="Editar mecánico" trigger={<Edit3 className="size-4" />} triggerClassName="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    <form action={saveMechanic} className="space-y-4">
                      <input type="hidden" name="id" value={m.id} />
                      <Field label="Nombre completo"><input name="name" required defaultValue={m.name} className="input" /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={m.active} /> Activo</label>
                      <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                    </form>
                  </Modal>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
