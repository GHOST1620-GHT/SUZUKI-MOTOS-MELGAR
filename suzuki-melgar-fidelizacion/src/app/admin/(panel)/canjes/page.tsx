import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { QrCode, Ticket } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, dateTime, pts, REDEMPTION_STATUS } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { templates, waLink } from "@/lib/whatsapp";
import { SubmitButton, WhatsAppButton } from "@/components/client";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { changeRedemption, findRedemptionByCode, logReminder } from "../../actions";

export const metadata = { title: "Canjes" };

export default async function Canjes({ searchParams }: { searchParams: Promise<{ estado?: string; codigo?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const estado = sp.estado ?? "abiertos";
  const s = await getSettings();
  const statuses = estado === "abiertos" ? ["PENDIENTE", "APROBADO"] : estado === "todos" ? Object.keys(REDEMPTION_STATUS) : [estado];
  const rows = await db.query.redemptions.findMany({
    where: sp.codigo ? eq(S.redemptions.code, sp.codigo) : inArray(S.redemptions.status, statuses),
    orderBy: desc(S.redemptions.requestedAt),
    limit: 200,
    with: { customer: { with: { level: true } }, reward: true, handledBy: true },
  });

  return (
    <>
      <PageHeader title="Canjes de premios" subtitle="Solicitudes hechas por los clientes en el portal y entregas en mostrador." />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <form action={findRedemptionByCode} className="space-y-3">
            <label className="label flex items-center gap-2"><QrCode className="size-4" /> Validar código del cliente</label>
            <div className="flex gap-2">
              <input name="code" required className="input font-mono uppercase tracking-wider" placeholder="SM-XXXXXX" defaultValue={sp.codigo} />
              <SubmitButton pendingText="…">Buscar</SubmitButton>
            </div>
            <p className="hint">El cliente muestra este código desde su portal al reclamar el premio.</p>
          </form>
        </Card>
        <Card className="lg:col-span-2">
          <p className="label">Filtrar por estado</p>
          <div className="flex flex-wrap gap-2">
            {[["abiertos", "Por atender"], ["PENDIENTE", "Pendientes"], ["APROBADO", "Listos para entregar"], ["ENTREGADO", "Entregados"], ["CANCELADO", "Cancelados"], ["todos", "Todos"]].map(([k, l]) => (
              <Link key={k} href={`?estado=${k}`} className={`chip ${!sp.codigo && estado === k ? "chip-active" : ""}`}>{l}</Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500"><b>Flujo:</b> Pendiente → (alistar premio) Listo para entregar → el cliente lo reclama → Entregado. Cancelar devuelve los puntos.</p>
        </Card>
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={Ticket} title={sp.codigo ? "Código no encontrado" : "No hay canjes en este estado"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Código</th><th>Cliente</th><th>Premio</th><th className="text-right">Puntos</th><th>Solicitado</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const msg = templates.redemptionReady(r.customer.firstName, r.reward.name, r.code, s.businessName);
                  return (
                    <tr key={r.id} className={sp.codigo ? "bg-brand-50/50" : ""}>
                      <td className="font-mono text-sm font-bold text-slate-800">{r.code}<span className="block text-[11px] font-normal text-slate-400">{r.channel === "PORTAL" ? "Portal" : "Mostrador"}</span></td>
                      <td><Link href={`/admin/clientes/${r.customerId}`} className="font-medium text-slate-800 hover:text-brand-700">{r.customer.firstName} {r.customer.lastName}</Link><span className="block text-xs text-slate-400">CC {r.customer.document}</span></td>
                      <td><span className="mr-1 text-lg">{r.reward.emoji}</span>{r.reward.name}</td>
                      <td className="text-right font-semibold tabular-nums">{pts(r.points)}</td>
                      <td className="whitespace-nowrap text-slate-500">{dateTime(r.requestedAt)}</td>
                      <td>
                        <Badge tone={REDEMPTION_STATUS[r.status].tone}>{REDEMPTION_STATUS[r.status].label}</Badge>
                        {r.deliveredAt && <span className="block text-[11px] text-slate-400">{date(r.deliveredAt)}{r.handledBy ? ` · ${r.handledBy.name}` : ""}</span>}
                      </td>
                      <td>
                        {(r.status === "PENDIENTE" || r.status === "APROBADO") && (
                          <form action={changeRedemption} className="flex justify-end gap-1.5">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="back" value={`/admin/canjes?estado=${estado}`} />
                            {r.status === "PENDIENTE" && <button name="status" value="APROBADO" className="btn btn-primary btn-sm">Listo</button>}
                            <button name="status" value="ENTREGADO" className="btn btn-success btn-sm">Entregar</button>
                            <button name="status" value="CANCELADO" className="btn btn-ghost btn-sm text-red-600" formNoValidate>Cancelar</button>
                          </form>
                        )}
                        {r.status === "APROBADO" && (
                          <div className="mt-1.5 flex justify-end">
                            <WhatsAppButton href={waLink(r.customer.phone, msg)} onSend={logReminder.bind(null, { customerId: r.customerId, kind: "CANJE", message: msg })}>Avisar</WhatsAppButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
