import { asc } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, money, pts } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/client";
import { Field } from "@/components/ui";
import { changePassword, customerLogout, updateProfile } from "../../actions";

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const c = await requireCustomer();
  const s = await getSettings();
  const levels = await db.select().from(S.levels).orderBy(asc(S.levels.minPoints));
  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-4 p-5">
        <span className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: c.level?.color ?? "#0f2f9c" }}>{c.firstName[0]}{c.lastName[0]}</span>
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-900">{c.firstName} {c.lastName}</p>
          <p className="text-sm text-slate-500">CC {c.document} · Socio desde {date(c.createdAt, { month: "long", year: "numeric" })}</p>
          <p className="text-sm text-slate-500">Compras acumuladas: {money(c.lifetimeSpend)}</p>
        </div>
      </div>

      <div id="niveles" className="card p-5">
        <p className="font-semibold text-slate-900">Niveles del Club</p>
        <p className="text-sm text-slate-500">Subes de nivel con los puntos que ganas (canjear no te baja de nivel).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {levels.map((l) => {
            const mine = l.id === c.levelId;
            return (
              <div key={l.id} className={`rounded-2xl border-2 p-4 ${mine ? "" : "border-slate-100"}`} style={mine ? { borderColor: l.color } : undefined}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-3 py-0.5 text-xs font-extrabold text-white" style={{ background: l.color }}>★ {l.name}</span>
                  {mine ? <span className="text-xs font-bold" style={{ color: l.color }}>TU NIVEL</span> : <span className="text-xs text-slate-500">desde {pts(l.minPoints)} pts</span>}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  <li>⚡ Puntos x{l.multiplier}</li>
                  {l.benefits.split("\n").filter(Boolean).map((b) => <li key={b}>✓ {b}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">¿Cómo gano puntos?</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>🏍️ Motos: 1 pt por cada ${pts(s.pesosPerPointMOTO)}</li>
            <li>⚙️ Repuestos: 1 pt por cada ${pts(s.pesosPerPointREPUESTOS)}</li>
            <li>🪖 Accesorios: 1 pt por cada ${pts(s.pesosPerPointACCESORIOS)}</li>
            <li>🔧 Taller: 1 pt por cada ${pts(s.pesosPerPointTALLER)}</li>
            <li>🎂 Cumpleaños: {pts(s.birthdayBonus)} pts de regalo</li>
            <li>🤝 Referidos: {pts(s.referralBonus)} pts por amigo que compre</li>
          </ul>
          {s.expirationMonths > 0 && <p className="mt-2 text-xs text-slate-500">Los puntos vencen si pasas {s.expirationMonths} meses sin compras.</p>}
        </div>
      </div>

      <form action={updateProfile} className="card space-y-4 p-5">
        <p className="font-semibold text-slate-900">Mis datos</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Celular (WhatsApp)"><input name="phone" defaultValue={c.phone} required className="input py-3" /></Field>
          <Field label="Correo"><input name="email" type="email" defaultValue={c.email ?? ""} className="input py-3" /></Field>
          <Field label="Ciudad"><input name="city" defaultValue={c.city ?? ""} className="input py-3" /></Field>
          <Field label="Dirección"><input name="address" defaultValue={c.address ?? ""} className="input py-3" /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" name="acceptsMarketing" defaultChecked={c.acceptsMarketing} className="mt-0.5" /> Quiero recibir promociones, recordatorios de mantenimiento y novedades.</label>
        <SubmitButton className="btn btn-primary w-full sm:w-auto">Guardar datos</SubmitButton>
      </form>

      <form action={changePassword} className="card space-y-4 p-5">
        <p className="font-semibold text-slate-900">Cambiar contraseña</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="current" type="password" required className="input py-3" placeholder="Contraseña actual" />
          <input name="password" type="password" required minLength={6} className="input py-3" placeholder="Nueva contraseña" />
        </div>
        <SubmitButton className="btn btn-secondary w-full sm:w-auto">Actualizar contraseña</SubmitButton>
      </form>

      <form action={customerLogout}>
        <button className="btn btn-ghost w-full text-red-600 hover:bg-red-50"><LogOut className="size-4" /> Cerrar sesión</button>
      </form>
      <p className="pb-4 text-center text-xs text-slate-400">{s.businessName} · {s.businessAddress}<br />Tus datos se tratan según la Ley 1581 de 2012.</p>
    </div>
  );
}
