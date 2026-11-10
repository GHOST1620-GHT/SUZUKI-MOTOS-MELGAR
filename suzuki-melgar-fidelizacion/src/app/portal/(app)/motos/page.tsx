import { desc, eq } from "drizzle-orm";
import { Bike } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts } from "@/lib/format";
import { maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { WhatsAppButton } from "@/components/client";
import { EmptyState, Progress } from "@/components/ui";

export const metadata = { title: "Mis motos" };

export default async function MisMotos() {
  const c = await requireCustomer();
  const s = await getSettings();
  const motos = await db.query.motorcycles.findMany({ where: eq(S.motorcycles.customerId, c.id), with: { services: { orderBy: desc(S.serviceRecords.date) } } });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis motos</h1>
        <p className="text-sm text-slate-500">Mantenimiento al día = moto segura y garantía vigente. Cada servicio te suma puntos.</p>
      </div>
      {motos.length === 0 && <div className="card"><EmptyState icon={Bike} title="No tienes motos registradas" text="Pide en el concesionario que asocien tu moto a tu cuenta." /></div>}
      {motos.map((m) => {
        const st = maintenanceStatus(m, s.reminderLeadDays);
        const base = m.lastServiceKm ?? 0;
        const used = Math.round(((m.currentKm - base) / m.serviceIntervalKm) * 100);
        return (
          <div key={m.id} className="card overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-brand-800 to-brand-600 p-5 text-white">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70">{m.brand}</p>
                <p className="text-xl font-bold">{m.model}</p>
                <p className="text-xs text-white/70">{[m.year, m.color].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="rounded-md border-2 border-slate-900 bg-yellow-300 px-3 py-1 font-mono text-lg font-extrabold tracking-wider text-slate-900">{m.plate ?? "S/P"}</span>
            </div>
            <div className="p-5">
              <div className={`rounded-2xl p-4 ${st.state === "VENCIDO" ? "bg-red-50" : st.state === "PROXIMO" ? "bg-amber-50" : "bg-emerald-50"}`}>
                <p className={`font-semibold ${st.state === "VENCIDO" ? "text-red-800" : st.state === "PROXIMO" ? "text-amber-800" : "text-emerald-800"}`}>
                  {st.state === "VENCIDO" ? "⚠️ Mantenimiento vencido" : st.state === "PROXIMO" ? `⏰ Tu mantenimiento es en ${st.daysLeft} días` : "✅ Tu moto está al día"}
                </p>
                <p className="mt-1 text-sm text-slate-600">Próximo servicio: <b>{date(st.dueDate)}</b> o a los <b>{pts(st.nextKm)} km</b> (lo que ocurra primero).</p>
                <div className="mt-3">
                  <Progress value={used} color={st.state === "VENCIDO" ? "#dc2626" : st.state === "PROXIMO" ? "#d97706" : "#059669"} />
                  <p className="mt-1 text-xs text-slate-500">{pts(m.currentKm)} km registrados · intervalo cada {pts(m.serviceIntervalKm)} km / {m.serviceIntervalDays} días</p>
                </div>
                <div className="mt-3">
                  <WhatsAppButton className="btn btn-whatsapp w-full sm:w-auto" href={waLink(s.businessPhone, `Hola, soy ${c.firstName} ${c.lastName} (CC ${c.document}). Quiero agendar mantenimiento para mi ${m.model} placa ${m.plate ?? ""}. Kilometraje aprox: ____ km.`)}>Agendar cita en el taller</WhatsAppButton>
                </div>
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-800">Historial de servicios</p>
              {m.services.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aún no hay servicios registrados.</p> : (
                <ol className="relative mt-3 space-y-4 border-l-2 border-slate-200 pl-5">
                  {m.services.map((sv) => (
                    <li key={sv.id} className="relative">
                      <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
                      <p className="text-sm font-semibold text-slate-800">{sv.type}</p>
                      <p className="text-xs text-slate-500">{date(sv.date)} · {pts(sv.km)} km</p>
                      {sv.notes && <p className="mt-0.5 text-xs text-slate-500">{sv.notes}</p>}
                    </li>
                  ))}
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-accent-500" />
                    <p className="text-sm font-semibold text-slate-800">Compra de la moto 🏍️</p>
                    <p className="text-xs text-slate-500">{date(m.purchaseDate)}</p>
                  </li>
                </ol>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
