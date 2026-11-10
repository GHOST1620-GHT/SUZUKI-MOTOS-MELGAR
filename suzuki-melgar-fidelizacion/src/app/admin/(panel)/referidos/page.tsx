import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Trophy, UserPlus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts, REFERRAL_STATUS } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { SubmitButton, WhatsAppButton } from "@/components/client";
import { CustomerPicker } from "@/components/customer-picker";
import { Badge, Card, EmptyState, Field, PageHeader, StatCard } from "@/components/ui";
import { createReferral, updateReferral } from "../../actions";
import { CheckCircle2, Clock, Coins } from "lucide-react";

export const metadata = { title: "Referidos" };

export default async function Referidos({ searchParams }: { searchParams: Promise<{ estado?: string; referente?: string }> }) {
  await requireStaff(["ADMIN", "ASESOR"]);
  const sp = await searchParams;
  const estado = sp.estado ?? "abiertos";
  const s = await getSettings();
  const statuses = estado === "abiertos" ? ["PENDIENTE", "CONTACTADO"] : estado === "todos" ? Object.keys(REFERRAL_STATUS) : [estado];
  const [rows, all, referente] = await Promise.all([
    db.query.referrals.findMany({ where: inArray(S.referrals.status, statuses), orderBy: desc(S.referrals.createdAt), with: { referrer: true, referredCustomer: true } }),
    db.query.referrals.findMany({ with: { referrer: true } }),
    sp.referente ? db.query.customers.findFirst({ where: eq(S.customers.id, sp.referente) }) : null,
  ]);
  const converted = all.filter((r) => r.status === "COMPRO");
  const ranking = Object.values(
    converted.reduce<Record<string, { id: string; name: string; n: number; pts: number }>>((acc, r) => {
      acc[r.referrerId] ??= { id: r.referrerId, name: `${r.referrer.firstName} ${r.referrer.lastName}`, n: 0, pts: 0 };
      acc[r.referrerId].n++;
      acc[r.referrerId].pts += r.bonusPoints;
      return acc;
    }, {}),
  ).sort((a, b) => b.n - a.n).slice(0, 5);

  return (
    <>
      <PageHeader title="Programa de referidos" subtitle={`Cuando un referido compra su moto, quien lo recomendó gana ${pts(s.referralBonus)} puntos automáticamente.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Por gestionar" value={all.filter((r) => ["PENDIENTE", "CONTACTADO"].includes(r.status)).length} icon={Clock} tone="amber" />
        <StatCard label="Convertidos en venta" value={converted.length} icon={CheckCircle2} tone="green" hint={all.length ? `Tasa de conversión ${Math.round((converted.length / all.length) * 100)}%` : undefined} />
        <StatCard label="Puntos pagados" value={pts(converted.reduce((a, r) => a + r.bonusPoints, 0))} icon={Coins} tone="purple" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card padded={false}>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
              {[["abiertos", "Por gestionar"], ["PENDIENTE", "Pendientes"], ["CONTACTADO", "Contactados"], ["COMPRO", "Compraron"], ["DESCARTADO", "Descartados"], ["todos", "Todos"]].map(([k, l]) => (
                <Link key={k} href={`?estado=${k}`} className={`chip ${estado === k ? "chip-active" : ""}`}>{l}</Link>
              ))}
            </div>
            {rows.length === 0 ? <EmptyState icon={UserPlus} title="No hay referidos en este estado" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Prospecto</th><th>Interés</th><th>Referido por</th><th>Fecha</th><th>Estado</th><th className="text-right">Gestión</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><span className="font-semibold text-slate-800">{r.name}</span><span className="block text-xs text-slate-500">{r.phone}</span></td>
                        <td className="text-slate-600">{r.interest ?? "—"}</td>
                        <td><Link href={`/admin/clientes/${r.referrerId}`} className="text-slate-700 hover:text-brand-700">{r.referrer.firstName} {r.referrer.lastName}</Link></td>
                        <td className="text-slate-500">{date(r.createdAt)}</td>
                        <td><Badge tone={REFERRAL_STATUS[r.status].tone}>{REFERRAL_STATUS[r.status].label}</Badge>{r.bonusPoints > 0 && <span className="block text-xs text-emerald-600">+{pts(r.bonusPoints)} pts</span>}</td>
                        <td>
                          {r.status !== "COMPRO" && (
                            <div className="flex justify-end gap-1.5">
                              <WhatsAppButton href={waLink(r.phone, `Hola ${r.name.split(" ")[0]}, te escribimos de ${s.businessName}. ${r.referrer.firstName} nos contó que estás interesado${r.interest ? ` en la ${r.interest}` : " en una moto"}. ¿Te gustaría conocer precios y planes de financiación? 🏍️`)}>Contactar</WhatsAppButton>
                              <form action={updateReferral} className="flex gap-1">
                                <input type="hidden" name="id" value={r.id} />
                                <select name="status" defaultValue={r.status} className="input py-1 text-xs">
                                  <option value="PENDIENTE">Pendiente</option><option value="CONTACTADO">Contactado</option><option value="COMPRO">Compró ✓</option><option value="DESCARTADO">Descartado</option>
                                </select>
                                <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">OK</SubmitButton>
                              </form>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Registrar referido">
            {!referente ? (
              <>
                <p className="mb-3 text-sm text-slate-600">¿Qué cliente está recomendando?</p>
                <CustomerPicker basePath={`/admin/referidos?estado=${estado}`} param="referente" autoFocus={false} />
              </>
            ) : (
              <form action={createReferral} className="space-y-3">
                <input type="hidden" name="referrerId" value={referente.id} />
                <p className="rounded-lg bg-brand-50 p-3 text-sm">Refiere: <b>{referente.firstName} {referente.lastName}</b> <Link href="/admin/referidos" className="ml-2 text-xs text-brand-700 underline">cambiar</Link></p>
                <Field label="Nombre del prospecto"><input name="name" required className="input" /></Field>
                <Field label="Celular"><input name="phone" required className="input" /></Field>
                <Field label="Moto de interés"><input name="interest" className="input" /></Field>
                <Field label="Notas"><textarea name="notes" rows={2} className="input" /></Field>
                <SubmitButton className="btn btn-primary w-full">Registrar referido</SubmitButton>
              </form>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Trophy className="size-4 text-amber-500" /> Mejores embajadores</span>} padded={false}>
            {ranking.length === 0 ? <p className="p-5 text-sm text-slate-500">Aún no hay referidos convertidos.</p> : (
              <ul className="divide-y divide-slate-100">
                {ranking.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="text-lg">{["🥇", "🥈", "🥉", "4.", "5."][i]}</span>
                    <Link href={`/admin/clientes/${r.id}`} className="flex-1 font-medium text-slate-800 hover:text-brand-700">{r.name}</Link>
                    <span className="text-xs text-slate-500">{r.n} ventas · {pts(r.pts)} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
