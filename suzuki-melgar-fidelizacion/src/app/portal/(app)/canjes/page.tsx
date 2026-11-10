import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Ticket } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts, REDEMPTION_STATUS } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui";

export const metadata = { title: "Mis canjes" };

export default async function MisCanjes() {
  const c = await requireCustomer();
  const rows = await db.query.redemptions.findMany({ where: eq(S.redemptions.customerId, c.id), orderBy: desc(S.redemptions.requestedAt), with: { reward: true } });
  const open = rows.filter((r) => r.status === "PENDIENTE" || r.status === "APROBADO");
  const closed = rows.filter((r) => !open.includes(r));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis canjes</h1>
        <p className="text-sm text-slate-500">Muestra el código en el concesionario para reclamar tu premio.</p>
      </div>
      {rows.length === 0 && <div className="card"><EmptyState icon={Ticket} title="Aún no has canjeado premios" action={<Link href="/portal/premios" className="btn btn-primary">Ver premios</Link>} /></div>}
      {open.map((r) => (
        <div key={r.id} className="card overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            <span className="text-5xl">{r.reward.emoji}</span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{r.reward.name}</p>
              <p className="text-xs text-slate-500">Solicitado el {date(r.requestedAt)} · {pts(r.points)} pts</p>
              <Badge tone={REDEMPTION_STATUS[r.status].tone} className="mt-2">{r.status === "APROBADO" ? "¡Listo! Pasa a reclamarlo" : "Estamos alistando tu premio"}</Badge>
            </div>
          </div>
          <div className="border-t-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Código de canje</p>
            <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.15em] text-brand-900">{r.code}</p>
          </div>
        </div>
      ))}
      {closed.length > 0 && (
        <div className="card divide-y divide-slate-100">
          <p className="px-5 py-3 text-sm font-semibold text-slate-700">Historial</p>
          {closed.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-2xl">{r.reward.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{r.reward.name}</p>
                <p className="text-xs text-slate-500">{r.code} · {date(r.deliveredAt ?? r.requestedAt)}</p>
              </div>
              <Badge tone={REDEMPTION_STATUS[r.status].tone}>{REDEMPTION_STATUS[r.status].label}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
