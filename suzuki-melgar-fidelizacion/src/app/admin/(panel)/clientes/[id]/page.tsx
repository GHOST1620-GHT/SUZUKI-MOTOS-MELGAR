import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { Bike, Cake, Coins, Edit3, Gift, KeyRound, Mail, MapPin, Phone, PlusCircle, Settings2, Sparkles, Trash2, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { CATEGORIES, date, dateTime, money, MOVEMENT_TYPES, pts, REDEMPTION_STATUS, REFERRAL_STATUS, relative, type Category } from "@/lib/format";
import { getLevelProgress, maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { templates, waLink } from "@/lib/whatsapp";
import { CopyButton, Modal, SubmitButton, WhatsAppButton } from "@/components/client";
import { CustomerFields } from "@/components/customer-form";
import { MotoForm, ServiceForm } from "@/components/forms";
import { Avatar, Badge, Card, EmptyState, Field, LevelBadge, Points, Progress } from "@/components/ui";
import { adjustPoints, changeRedemption, createReferral, deleteCustomer, deleteMotorcycle, logReminder, setPortalPassword, staffRedeem, updateCustomer, voidPurchase } from "../../../actions";

const TABS = [
  ["movimientos", "Historial de puntos"],
  ["compras", "Compras"],
  ["canjes", "Canjes"],
  ["servicios", "Servicios de taller"],
  ["referidos", "Referidos"],
  ["contactos", "Mensajes enviados"],
] as const;

export default async function ClienteDetalle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const { tab = "movimientos" } = await searchParams;
  const s = await getSettings();
  const c = await db.query.customers.findFirst({
    where: eq(S.customers.id, id),
    with: {
      level: true,
      referredBy: true,
      motorcycles: { orderBy: asc(S.motorcycles.createdAt), with: { services: { orderBy: desc(S.serviceRecords.date), with: { createdBy: true } } } },
      movements: { orderBy: desc(S.pointMovements.createdAt), limit: 100, with: { createdBy: true } },
      purchases: { orderBy: desc(S.purchases.date), with: { motorcycle: true, createdBy: true } },
      redemptions: { orderBy: desc(S.redemptions.requestedAt), with: { reward: true } },
      referralsMade: { orderBy: desc(S.referrals.createdAt) },
      reminders: { orderBy: desc(S.reminderLogs.sentAt), with: { sentBy: true } },
    },
  });
  if (!c) notFound();

  const [progress, rewards] = await Promise.all([
    getLevelProgress(c.lifetimePoints),
    db.query.rewards.findMany({ where: eq(S.rewards.active, true), orderBy: asc(S.rewards.pointsCost), with: { minLevel: true } }),
  ]);
  const fullName = `${c.firstName} ${c.lastName}`;
  const back = `/admin/clientes/${c.id}`;
  const services = c.motorcycles.flatMap((m) => m.services.map((sv) => ({ ...sv, moto: m }))).sort((a, b) => b.date.getTime() - a.date.getTime());
  const msgPoints = templates.points(c.firstName, c.pointsBalance, c.level?.name ?? "", s.businessName);
  const age = c.birthDate ? Math.floor((Date.now() - c.birthDate.getTime()) / (365.25 * 86400000)) : null;

  return (
    <>
      <Link href="/admin/clientes" className="mb-3 inline-flex text-sm font-medium text-brand-700 hover:underline">← Clientes</Link>

      {/* Encabezado */}
      <div className="card mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600" style={c.level ? { background: `linear-gradient(110deg, #0a1c57, ${c.level.color})` } : undefined} />
        <div className="flex flex-col gap-4 px-6 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <span className="rounded-full ring-4 ring-white"><Avatar name={fullName} color={c.level?.color} size={84} /></span>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
                <LevelBadge level={c.level} />
              </div>
              <p className="text-sm text-slate-500">{c.documentType} {c.document} · Cliente desde {date(c.createdAt, { month: "long", year: "numeric" })} · Última visita: {relative(c.lastVisitAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Link href={`/admin/compras/nueva?cliente=${c.id}`} className="btn btn-accent"><PlusCircle className="size-4" /> Registrar compra</Link>
            <Modal title={`Canjear premio · ${pts(c.pointsBalance)} pts disponibles`} trigger={<><Gift className="size-4" /> Canjear</>} triggerClassName="btn btn-primary" size="lg">
              <div className="grid gap-3 sm:grid-cols-2">
                {rewards.map((r) => {
                  const lockedLevel = r.minLevel && (c.level?.minPoints ?? 0) < r.minLevel.minPoints;
                  const can = c.pointsBalance >= r.pointsCost && !lockedLevel && (r.stock === null || r.stock > 0);
                  return (
                    <form key={r.id} action={staffRedeem} className={`flex items-start gap-3 rounded-xl border p-3 ${can ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
                      <input type="hidden" name="customerId" value={c.id} />
                      <input type="hidden" name="rewardId" value={r.id} />
                      <span className="text-3xl">{r.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-500">{pts(r.pointsCost)} pts{r.stock !== null ? ` · ${r.stock} disp.` : ""}{lockedLevel ? ` · Nivel ${r.minLevel!.name}+` : ""}</p>
                        <SubmitButton className="btn btn-primary btn-sm mt-2" pendingText="…" confirm={can ? `¿Entregar "${r.name}" por ${r.pointsCost} puntos?` : undefined}>{can ? "Entregar ahora" : "No disponible"}</SubmitButton>
                      </div>
                    </form>
                  );
                })}
              </div>
            </Modal>
            <Modal title="Ajustar puntos" trigger={<><Coins className="size-4" /> Ajustar puntos</>} triggerClassName="btn btn-secondary">
              <form action={adjustPoints} className="space-y-4">
                <input type="hidden" name="customerId" value={c.id} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"><input type="radio" name="direction" value="sumar" defaultChecked /> Sumar puntos</label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 has-[:checked]:border-red-500 has-[:checked]:bg-red-50"><input type="radio" name="direction" value="restar" /> Restar puntos</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cantidad de puntos"><input name="points" required inputMode="numeric" className="input" /></Field>
                  <Field label="Tipo (al sumar)">
                    <select name="type" className="input"><option value="BONO">Bono / promoción</option><option value="AJUSTE">Corrección</option></select>
                  </Field>
                </div>
                <Field label="Motivo *" hint="Queda en el historial y el cliente lo ve en su portal."><input name="reason" required className="input" placeholder="Ej: Bono por participar en rodada" /></Field>
                <div className="flex justify-end"><SubmitButton>Aplicar ajuste</SubmitButton></div>
              </form>
            </Modal>
            <WhatsAppButton href={waLink(c.phone, msgPoints)} onSend={logReminder.bind(null, { customerId: c.id, kind: "PUNTOS", message: msgPoints })} className="btn btn-whatsapp">Enviar saldo</WhatsAppButton>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Columna izquierda */}
        <div className="space-y-6">
          <Card>
            <p className="text-sm font-medium text-slate-500">Puntos disponibles</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">{pts(c.pointsBalance)}</p>
            <p className="text-xs text-slate-500">≈ {money(c.pointsBalance * s.pointValueCOP)} en beneficios</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Puntos históricos</p><p className="font-bold">{pts(c.lifetimePoints)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Compras totales</p><p className="font-bold">{money(c.lifetimeSpend)}</p></div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <LevelBadge level={c.level} />
                {progress.next ? <span className="text-xs text-slate-500">Faltan <b className="text-slate-800">{pts(progress.missing)}</b> para {progress.next.name}</span> : <span className="text-xs font-semibold text-brand-700">Nivel máximo 🏆</span>}
              </div>
              <Progress value={progress.progress} color={progress.next?.color ?? c.level?.color} />
              {c.level && (
                <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <li className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" /> Gana puntos x{c.level.multiplier}</li>
                  {c.level.benefits.split("\n").filter(Boolean).map((b) => <li key={b} className="flex gap-2"><span className="text-emerald-500">✓</span> {b}</li>)}
                </ul>
              )}
            </div>
          </Card>

          <Card
            title="Datos de contacto"
            actions={
              <Modal title="Editar cliente" trigger={<Edit3 className="size-4" />} triggerClassName="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" size="lg">
                <form action={updateCustomer} className="space-y-4">
                  <input type="hidden" name="id" value={c.id} />
                  <CustomerFields c={c} />
                  <div className="flex justify-end"><SubmitButton>Guardar cambios</SubmitButton></div>
                </form>
              </Modal>
            }
          >
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3"><Phone className="size-4 text-slate-400" /> <a href={`tel:${c.phone}`} className="text-slate-700 hover:text-brand-700">{c.phone}</a></li>
              <li className="flex items-center gap-3"><Mail className="size-4 text-slate-400" /> {c.email ? <a href={`mailto:${c.email}`} className="truncate text-slate-700 hover:text-brand-700">{c.email}</a> : <span className="text-slate-400">Sin correo</span>}</li>
              <li className="flex items-center gap-3"><MapPin className="size-4 text-slate-400" /> <span className="text-slate-700">{[c.address, c.city].filter(Boolean).join(", ") || "—"}</span></li>
              <li className="flex items-center gap-3"><Cake className="size-4 text-slate-400" /> <span className="text-slate-700">{c.birthDate ? `${date(c.birthDate, { day: "numeric", month: "long", timeZone: "UTC" })} · ${age} años` : "—"}</span></li>
            </ul>
            {c.notes && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">📝 {c.notes}</p>}
            <p className="mt-4 text-xs text-slate-500">{c.acceptsMarketing ? "✓ Autorizó tratamiento de datos y promociones" : "✗ No desea recibir promociones"}</p>
          </Card>

          <Card title="Portal de clientes" actions={<KeyRound className="size-4 text-slate-400" />}>
            {c.passwordHash ? (
              <p className="text-sm text-slate-600"><Badge tone="green">Activo</Badge> <span className="ml-1">desde {date(c.portalActivatedAt)}</span></p>
            ) : (
              <p className="text-sm text-slate-600"><Badge tone="amber">Sin activar</Badge> <span className="ml-1">El cliente puede activarlo en <b>/portal/activar</b> con su cédula y celular.</span></p>
            )}
            <form action={setPortalPassword} className="mt-4 flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="password" className="input" placeholder={c.passwordHash ? "Nueva contraseña" : "Asignar contraseña"} minLength={6} required />
              <SubmitButton className="btn btn-secondary" pendingText="…">{c.passwordHash ? "Cambiar" : "Activar"}</SubmitButton>
            </form>
          </Card>

          <Card title="Programa de referidos">
            <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-3">
              <div>
                <p className="text-xs text-brand-700">Código del cliente</p>
                <p className="font-mono text-lg font-bold tracking-wider text-brand-900">{c.referralCode}</p>
              </div>
              <CopyButton text={c.referralCode} />
            </div>
            {c.referredBy && <p className="mt-3 text-sm text-slate-600">Fue referido por <Link className="font-semibold text-brand-700 hover:underline" href={`/admin/clientes/${c.referredBy.id}`}>{c.referredBy.firstName} {c.referredBy.lastName}</Link></p>}
            <p className="mt-3 text-sm text-slate-600">{c.referralsMade.length} referidos · {c.referralsMade.filter((r) => r.status === "COMPRO").length} compraron</p>
          </Card>

          {user.role === "ADMIN" && (
            <form action={deleteCustomer}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-ghost w-full text-red-600 hover:bg-red-50" confirm={`¿Eliminar definitivamente a ${fullName} y todo su historial? Esta acción no se puede deshacer.`}><Trash2 className="size-4" /> Eliminar cliente</SubmitButton>
            </form>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-6 xl:col-span-2">
          <Card
            title={<span className="flex items-center gap-2"><Bike className="size-4 text-brand-700" /> Motos ({c.motorcycles.length})</span>}
            actions={<Modal title="Agregar moto" trigger={<><PlusCircle className="size-4" /> Agregar moto</>} triggerClassName="btn btn-secondary btn-sm" size="lg"><MotoForm customerId={c.id} /></Modal>}
          >
            {c.motorcycles.length === 0 ? (
              <EmptyState icon={Bike} title="Sin motos registradas" text="Agregue la moto del cliente para controlar sus mantenimientos." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {c.motorcycles.map((m) => {
                  const st = maintenanceStatus(m, s.reminderLeadDays);
                  const msg = templates.maintenance(c.firstName, m.model, m.plate, s.businessName);
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{m.brand} {m.model}</p>
                          <p className="text-xs text-slate-500">{[m.year, m.color].filter(Boolean).join(" · ")}{m.purchaseDate ? ` · comprada ${date(m.purchaseDate)}` : ""}</p>
                        </div>
                        <span className="rounded-md border-2 border-slate-800 bg-yellow-300 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-slate-900">{m.plate ?? "S/P"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Km actual</p><p className="font-bold text-slate-800">{pts(m.currentKm)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Último serv.</p><p className="font-bold text-slate-800">{m.lastServiceDate ? date(m.lastServiceDate, { day: "2-digit", month: "short" }) : "—"}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Próximo</p><p className="font-bold text-slate-800">{pts(st.nextKm)} km</p></div>
                      </div>
                      <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-sm ${st.state === "VENCIDO" ? "bg-red-50 text-red-800" : st.state === "PROXIMO" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                        <span className="font-medium">
                          {st.state === "VENCIDO" ? "⚠ Mantenimiento vencido" : st.state === "PROXIMO" ? `⏰ Mantenimiento en ${st.daysLeft} días` : "✓ Al día"}
                        </span>
                        <span className="text-xs">{date(st.dueDate)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Modal title="Registrar servicio de taller" trigger={<><Wrench className="size-3.5" /> Registrar servicio</>} triggerClassName="btn btn-primary btn-sm"><ServiceForm moto={m} back={back} /></Modal>
                        <WhatsAppButton href={waLink(c.phone, msg)} onSend={logReminder.bind(null, { customerId: c.id, motorcycleId: m.id, kind: "MANTENIMIENTO", message: msg })}>Recordar</WhatsAppButton>
                        <Modal title="Editar moto" trigger={<Settings2 className="size-3.5" />} triggerClassName="btn btn-ghost btn-sm" size="lg">
                          <MotoForm customerId={c.id} moto={m} />
                          {user.role === "ADMIN" && (
                            <form action={deleteMotorcycle} className="mt-4 border-t border-slate-100 pt-4">
                              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="customerId" value={c.id} />
                              <SubmitButton className="btn btn-ghost btn-sm text-red-600" confirm="¿Eliminar esta moto y su historial de servicios?">Eliminar moto</SubmitButton>
                            </form>
                          )}
                        </Modal>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
              {TABS.map(([k, label]) => (
                <Link key={k} href={`${back}?tab=${k}`} scroll={false} className={`whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium ${tab === k ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</Link>
              ))}
            </div>
            <div className="overflow-x-auto">
              {tab === "movimientos" && (
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th className="text-right">Puntos</th><th className="text-right">Saldo</th></tr></thead>
                  <tbody>
                    {c.movements.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-slate-500">{dateTime(m.createdAt)}</td>
                        <td><Badge tone={MOVEMENT_TYPES[m.type]?.tone}>{MOVEMENT_TYPES[m.type]?.label ?? m.type}</Badge></td>
                        <td className="text-slate-700">{m.description}{m.createdBy && <span className="block text-xs text-slate-400">por {m.createdBy.name}</span>}</td>
                        <td className="text-right"><Points value={m.points} /></td>
                        <td className="text-right tabular-nums text-slate-600">{pts(m.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "compras" && (
                c.purchases.length === 0 ? <EmptyState icon={Coins} title="Sin compras" /> :
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Factura</th><th>Categoría</th><th>Moto</th><th className="text-right">Valor</th><th className="text-right">Puntos</th><th>Origen</th>{user.role === "ADMIN" && <th />}</tr></thead>
                  <tbody>
                    {c.purchases.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-slate-500">{date(p.date)}</td>
                        <td className="font-mono text-xs">{p.invoiceNumber ?? "—"}</td>
                        <td><span className="inline-flex items-center gap-1.5 text-sm"><span className="size-2 rounded-full" style={{ background: CATEGORIES[p.category as Category]?.color }} />{CATEGORIES[p.category as Category]?.label}</span></td>
                        <td className="text-xs text-slate-500">{p.motorcycle ? `${p.motorcycle.model} ${p.motorcycle.plate ?? ""}` : "—"}</td>
                        <td className="text-right tabular-nums">{money(p.amount)}</td>
                        <td className="text-right"><Points value={p.pointsEarned} /></td>
                        <td><Badge tone={p.source === "MANUAL" ? "gray" : "blue"}>{p.source === "IMPORTACION" ? "MasControl" : p.source === "API" ? "API" : "Manual"}</Badge></td>
                        {user.role === "ADMIN" && (
                          <td>
                            <form action={voidPurchase}>
                              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={`${back}?tab=compras`} />
                              <SubmitButton className="btn btn-ghost btn-sm text-red-600" pendingText="…" confirm={`¿Anular la compra ${p.invoiceNumber ?? ""} y revertir ${p.pointsEarned} puntos?`}>Anular</SubmitButton>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "canjes" && (
                c.redemptions.length === 0 ? <EmptyState icon={Gift} title="Sin canjes todavía" /> :
                <table className="table">
                  <thead><tr><th>Código</th><th>Premio</th><th>Fecha</th><th>Canal</th><th className="text-right">Puntos</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {c.redemptions.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-xs font-bold">{r.code}</td>
                        <td>{r.reward.emoji} {r.reward.name}</td>
                        <td className="text-slate-500">{date(r.requestedAt)}</td>
                        <td className="text-xs text-slate-500">{r.channel === "PORTAL" ? "Portal" : "Mostrador"}</td>
                        <td className="text-right font-semibold text-red-600">-{pts(r.points)}</td>
                        <td><Badge tone={REDEMPTION_STATUS[r.status].tone}>{REDEMPTION_STATUS[r.status].label}</Badge></td>
                        <td>
                          {(r.status === "PENDIENTE" || r.status === "APROBADO") && (
                            <form action={changeRedemption} className="flex gap-1">
                              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={`${back}?tab=canjes`} />
                              <button name="status" value="ENTREGADO" className="btn btn-success btn-sm">Entregar</button>
                              <button name="status" value="CANCELADO" className="btn btn-ghost btn-sm text-red-600">Cancelar</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "servicios" && (
                services.length === 0 ? <EmptyState icon={Wrench} title="Sin servicios registrados" /> :
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Moto</th><th>Servicio</th><th className="text-right">Km</th><th>Registró</th></tr></thead>
                  <tbody>
                    {services.map((sv) => (
                      <tr key={sv.id}>
                        <td className="whitespace-nowrap text-slate-500">{date(sv.date)}</td>
                        <td className="text-sm">{sv.moto.model} <span className="text-xs text-slate-400">{sv.moto.plate}</span></td>
                        <td>{sv.type}{sv.notes && <span className="block text-xs text-slate-400">{sv.notes}</span>}</td>
                        <td className="text-right tabular-nums">{pts(sv.km)}</td>
                        <td className="text-xs text-slate-500">{sv.createdBy?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "referidos" && (
                <div className="p-5">
                  <form action={createReferral} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
                    <input type="hidden" name="referrerId" value={c.id} /><input type="hidden" name="back" value={`${back}?tab=referidos`} />
                    <input name="name" required className="input" placeholder="Nombre del referido" />
                    <input name="phone" required className="input" placeholder="Celular" />
                    <input name="interest" className="input" placeholder="Moto de interés" list="modelos" />
                    <SubmitButton>Registrar referido</SubmitButton>
                  </form>
                  {c.referralsMade.length === 0 ? <p className="text-sm text-slate-500">Este cliente aún no ha referido a nadie.</p> : (
                    <table className="table">
                      <thead><tr><th>Referido</th><th>Celular</th><th>Interés</th><th>Fecha</th><th>Estado</th><th className="text-right">Bono</th></tr></thead>
                      <tbody>
                        {c.referralsMade.map((r) => (
                          <tr key={r.id}>
                            <td className="font-medium">{r.name}</td><td>{r.phone}</td><td className="text-slate-500">{r.interest ?? "—"}</td><td className="text-slate-500">{date(r.createdAt)}</td>
                            <td><Badge tone={REFERRAL_STATUS[r.status].tone}>{REFERRAL_STATUS[r.status].label}</Badge></td>
                            <td className="text-right">{r.bonusPoints ? <Points value={r.bonusPoints} /> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {tab === "contactos" && (
                c.reminders.length === 0 ? <EmptyState icon={Phone} title="No se han enviado mensajes" text="Los recordatorios por WhatsApp enviados desde el sistema aparecen aquí." /> :
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Mensaje</th><th>Enviado por</th></tr></thead>
                  <tbody>
                    {c.reminders.map((r) => (
                      <tr key={r.id}><td className="whitespace-nowrap text-slate-500">{dateTime(r.sentAt)}</td><td><Badge tone="green">{r.kind}</Badge></td><td className="max-w-md text-xs text-slate-600">{r.message}</td><td className="text-xs">{r.sentBy?.name}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
