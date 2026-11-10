import Link from "next/link";
import { and, asc, count, desc, eq, exists, gte, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { Download, Search, UserPlus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { money, pts, relative } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, EmptyState, LevelBadge, PageHeader, Pagination } from "@/components/ui";

export const metadata = { title: "Clientes" };
const PER = 20;

export default async function Clientes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const s = await getSettings();
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.p ?? 1));
  const inactiveLimit = new Date(Date.now() - s.inactiveDays * 86400000);

  const where: (SQL | undefined)[] = [];
  if (q) {
    const like = `%${q}%`;
    where.push(
      or(
        ilike(sql`${S.customers.firstName} || ' ' || ${S.customers.lastName}`, like),
        ilike(S.customers.document, like),
        ilike(S.customers.phone, like),
        ilike(S.customers.email, like),
        exists(db.select().from(S.motorcycles).where(and(eq(S.motorcycles.customerId, S.customers.id), ilike(S.motorcycles.plate, like)))),
      ),
    );
  }
  if (sp.nivel) where.push(eq(S.customers.levelId, sp.nivel));
  if (sp.estado === "activos") where.push(gte(S.customers.lastVisitAt, inactiveLimit));
  if (sp.estado === "inactivos") where.push(or(lt(S.customers.lastVisitAt, inactiveLimit), isNull(S.customers.lastVisitAt)));
  if (sp.estado === "sinportal") where.push(isNull(S.customers.passwordHash));
  const w = and(...where);

  const order =
    sp.orden === "puntos" ? desc(S.customers.pointsBalance)
    : sp.orden === "compras" ? desc(S.customers.lifetimeSpend)
    : sp.orden === "visita" ? sql`${S.customers.lastVisitAt} desc nulls last`
    : sp.orden === "nombre" ? asc(S.customers.firstName)
    : desc(S.customers.createdAt);

  const [[{ n }], rows, levels] = await Promise.all([
    db.select({ n: count() }).from(S.customers).where(w),
    db.query.customers.findMany({ where: w, orderBy: order, limit: PER, offset: (page - 1) * PER, with: { level: true, motorcycles: true } }),
    db.select().from(S.levels).orderBy(S.levels.minPoints),
  ]);
  const pages = Math.ceil(n / PER);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/clientes${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${pts(n)} clientes${q ? ` que coinciden con “${q}”` : " inscritos en el programa"}`}
        actions={
          <>
            <a href={`/api/export/clientes`} className="btn btn-secondary"><Download className="size-4" /> Exportar Excel</a>
            <Link href="/admin/clientes/nuevo" className="btn btn-primary"><UserPlus className="size-4" /> Nuevo cliente</Link>
          </>
        }
      />

      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <form className="flex gap-2" action="/admin/clientes">
            {sp.nivel && <input type="hidden" name="nivel" value={sp.nivel} />}
            {sp.estado && <input type="hidden" name="estado" value={sp.estado} />}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} className="input pl-9" placeholder="Buscar por nombre, cédula, celular, correo o placa…" />
            </div>
            <button className="btn btn-primary">Buscar</button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Nivel:</span>
            <Link href={qs({ nivel: undefined, p: undefined })} className={`chip ${!sp.nivel ? "chip-active" : ""}`}>Todos</Link>
            {levels.map((l) => (
              <Link key={l.id} href={qs({ nivel: l.id, p: undefined })} className={`chip ${sp.nivel === l.id ? "chip-active" : ""}`}>{l.name}</Link>
            ))}
            <span className="ml-3 text-xs font-medium text-slate-500">Estado:</span>
            {[["", "Todos"], ["activos", "Activos"], ["inactivos", `Inactivos (+${s.inactiveDays} d)`], ["sinportal", "Sin acceso al portal"]].map(([v, l]) => (
              <Link key={v} href={qs({ estado: v || undefined, p: undefined })} className={`chip ${(sp.estado ?? "") === v ? "chip-active" : ""}`}>{l}</Link>
            ))}
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              Ordenar:
              {[["", "Recientes"], ["nombre", "Nombre"], ["puntos", "Puntos"], ["compras", "Compras"], ["visita", "Última visita"]].map(([v, l]) => (
                <Link key={v} href={qs({ orden: v || undefined })} className={`font-medium ${(sp.orden ?? "") === v ? "text-brand-700 underline" : "hover:text-slate-800"}`}>{l}</Link>
              ))}
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No se encontraron clientes" text="Pruebe con otra búsqueda o registre un cliente nuevo." action={<Link href="/admin/clientes/nuevo" className="btn btn-primary">Nuevo cliente</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th><th>Contacto</th><th>Motos</th><th>Nivel</th><th className="text-right">Puntos</th><th className="text-right">Compras</th><th>Última visita</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const inactive = !c.lastVisitAt || c.lastVisitAt < inactiveLimit;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={`${c.firstName} ${c.lastName}`} color={c.level?.color} size={36} />
                          <span>
                            <span className="block font-semibold text-slate-800 hover:text-brand-700">{c.firstName} {c.lastName}</span>
                            <span className="block text-xs text-slate-500">{c.documentType} {c.document}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-slate-600">
                        <span className="block">{c.phone}</span>
                        <span className="block text-xs text-slate-400">{c.city}</span>
                      </td>
                      <td className="text-slate-600">
                        {c.motorcycles.slice(0, 2).map((m) => (
                          <span key={m.id} className="block text-xs"><b className="font-semibold text-slate-700">{m.plate ?? "—"}</b> {m.model}</span>
                        ))}
                        {c.motorcycles.length === 0 && <span className="text-xs text-slate-400">Sin motos</span>}
                      </td>
                      <td><LevelBadge level={c.level} /></td>
                      <td className="text-right font-bold tabular-nums text-slate-900">{pts(c.pointsBalance)}</td>
                      <td className="text-right tabular-nums text-slate-600">{money(c.lifetimeSpend)}</td>
                      <td>{inactive ? <Badge tone="amber">{relative(c.lastVisitAt)}</Badge> : <span className="text-slate-600">{relative(c.lastVisitAt)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} makeHref={(p) => qs({ p: String(p) })} />
      </Card>
    </>
  );
}
