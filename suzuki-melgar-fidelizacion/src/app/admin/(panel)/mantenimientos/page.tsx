import Link from "next/link";
import { desc } from "drizzle-orm";
import { AlertTriangle, CalendarClock, CheckCircle2, Gauge, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, dateTime, pts, relative } from "@/lib/format";
import { maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { templates, waLink } from "@/lib/whatsapp";
import { Modal, SubmitButton, WhatsAppButton } from "@/components/client";
import { ServiceForm } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { logReminder, updateKm } from "../../actions";

export const metadata = { title: "Mantenimientos" };

export default async function Mantenimientos({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireStaff();
  const { f = "atender" } = await searchParams;
  const s = await getSettings();
  const motos = await db.query.motorcycles.findMany({
    with: { customer: true, services: { orderBy: desc(S.serviceRecords.date), limit: 1 } },
  });
  const logs = await db.query.reminderLogs.findMany({ orderBy: desc(S.reminderLogs.sentAt), limit: 400 });
  const lastContact = new Map<string, Date>();
  for (const l of logs) if (l.motorcycleId && !lastContact.has(l.motorcycleId)) lastContact.set(l.motorcycleId, l.sentAt);

  const all = motos.map((m) => ({ m, st: maintenanceStatus(m, s.reminderLeadDays) })).sort((a, b) => a.st.daysLeft - b.st.daysLeft);
  const overdue = all.filter((x) => x.st.state === "VENCIDO");
  const soon = all.filter((x) => x.st.state === "PROXIMO");
  const ok = all.filter((x) => x.st.state === "AL_DIA");
  const list = f === "vencidos" ? overdue : f === "proximos" ? soon : f === "aldia" ? ok : f === "todos" ? all : [...overdue, ...soon];
  const recentLogs = logs.filter((l) => l.kind === "MANTENIMIENTO").slice(0, 8);

  return (
    <>
      <PageHeader title="Control de mantenimientos" subtitle={`Se calcula por kilometraje o por tiempo (lo que ocurra primero). Aviso con ${s.reminderLeadDays} días de anticipación.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Vencidos" value={overdue.length} icon={AlertTriangle} tone="red" href="?f=vencidos" />
        <StatCard label="Próximos" value={soon.length} icon={CalendarClock} tone="amber" href="?f=proximos" hint={`En los próximos ${s.reminderLeadDays} días`} />
        <StatCard label="Al día" value={ok.length} icon={CheckCircle2} tone="green" href="?f=aldia" />
        <StatCard label="Recordatorios este mes" value={logs.filter((l) => l.kind === "MANTENIMIENTO" && l.sentAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} icon={Wrench} tone="cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="xl:col-span-3" padded={false}>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
            {[["atender", `Por atender (${overdue.length + soon.length})`], ["vencidos", "Vencidos"], ["proximos", "Próximos"], ["aldia", "Al día"], ["todos", "Todas las motos"]].map(([k, l]) => (
              <Link key={k} href={`?f=${k}`} className={`chip ${f === k ? "chip-active" : ""}`}>{l}</Link>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nada pendiente" text="No hay motos en esta categoría." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Cliente / moto</th><th>Estado</th><th className="text-right">Km actual</th><th className="text-right">Próximo a</th><th>Último servicio</th><th>Contactado</th><th className="text-right">Acciones</th></tr></thead>
                <tbody>
                  {list.map(({ m, st }) => {
                    const msg = templates.maintenance(m.customer.firstName, m.model, m.plate, s.businessName);
                    const contacted = lastContact.get(m.id);
                    return (
                      <tr key={m.id}>
                        <td>
                          <Link href={`/admin/clientes/${m.customerId}`} className="font-semibold text-slate-800 hover:text-brand-700">{m.customer.firstName} {m.customer.lastName}</Link>
                          <span className="block text-xs text-slate-500">{m.model} · <b>{m.plate ?? "S/P"}</b> · {m.customer.phone}</span>
                        </td>
                        <td>
                          {st.state === "VENCIDO" ? <Badge tone="red">Vencido</Badge> : st.state === "PROXIMO" ? <Badge tone="amber">En {st.daysLeft} días</Badge> : <Badge tone="green">Al día</Badge>}
                          <span className="mt-1 block text-xs text-slate-500">{date(st.dueDate)} · por {st.reason}</span>
                        </td>
                        <td className="text-right tabular-nums">
                          <Modal title="Actualizar kilometraje" trigger={<span className="inline-flex items-center gap-1 underline decoration-dotted">{pts(m.currentKm)} <Gauge className="size-3" /></span>} triggerClassName="text-slate-700 hover:text-brand-700">
                            <form action={updateKm} className="flex gap-2">
                              <input type="hidden" name="motorcycleId" value={m.id} /><input type="hidden" name="back" value={`/admin/mantenimientos?f=${f}`} />
                              <input name="km" defaultValue={m.currentKm} inputMode="numeric" className="input" />
                              <SubmitButton>Guardar</SubmitButton>
                            </form>
                          </Modal>
                        </td>
                        <td className="text-right tabular-nums text-slate-600">{pts(st.nextKm)} km</td>
                        <td className="text-sm text-slate-600">{m.services[0] ? <>{m.services[0].type}<span className="block text-xs text-slate-400">{date(m.services[0].date)}</span></> : <span className="text-slate-400">Nunca</span>}</td>
                        <td className="text-xs text-slate-500">{contacted ? relative(contacted) : "—"}</td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <WhatsAppButton href={waLink(m.customer.phone, msg)} onSend={logReminder.bind(null, { customerId: m.customerId, motorcycleId: m.id, kind: "MANTENIMIENTO", message: msg })}>Avisar</WhatsAppButton>
                            <Modal title="Registrar servicio de taller" trigger={<Wrench className="size-3.5" />} triggerClassName="btn btn-primary btn-sm"><ServiceForm moto={m} back={`/admin/mantenimientos?f=${f}`} /></Modal>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Últimos recordatorios" padded={false}>
          {recentLogs.length === 0 ? <p className="p-5 text-sm text-slate-500">Aún no se han enviado recordatorios.</p> : (
            <ul className="divide-y divide-slate-100">
              {recentLogs.map((l) => {
                const moto = motos.find((m) => m.id === l.motorcycleId);
                return (
                  <li key={l.id} className="px-5 py-3 text-sm">
                    <p className="font-medium text-slate-800">{moto ? `${moto.customer.firstName} ${moto.customer.lastName}` : "Cliente"}</p>
                    <p className="text-xs text-slate-500">{moto?.model} · {dateTime(l.sentAt)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
