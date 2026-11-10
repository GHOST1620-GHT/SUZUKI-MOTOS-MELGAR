import { asc } from "drizzle-orm";
import { Bell, Clock, Coins, Edit3, Plus, Store, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { dateTime, ROLES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { User } from "@/db/schema";
import { Modal, SubmitButton } from "@/components/client";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { broadcastNotification, runJobsAction, saveSettingsAction, saveUser } from "../../actions";

export const metadata = { title: "Configuración" };

function UserForm({ u }: { u?: User }) {
  return (
    <form action={saveUser} className="space-y-4">
      {u && <input type="hidden" name="id" value={u.id} />}
      <Field label="Nombre completo"><input name="name" required defaultValue={u?.name} className="input" /></Field>
      <Field label="Correo (usuario)"><input name="email" type="email" required defaultValue={u?.email} className="input" /></Field>
      <Field label="Rol">
        <select name="role" defaultValue={u?.role ?? "ASESOR"} className="input">{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <Field label={u ? "Nueva contraseña (opcional)" : "Contraseña"}><input name="password" type="password" minLength={6} required={!u} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u?.active ?? true} /> Usuario activo</label>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><b>Administrador:</b> acceso total. <b>Asesor:</b> clientes, compras, canjes, premios, referidos e importación. <b>Taller:</b> clientes, compras, mantenimientos y canjes.</div>
      <div className="flex justify-end"><SubmitButton>Guardar usuario</SubmitButton></div>
    </form>
  );
}

const n = (v: number) => v.toLocaleString("es-CO");

export default async function Configuracion() {
  await requireStaff(["ADMIN"]);
  const s = await getSettings();
  const [users, levels] = await Promise.all([db.select().from(S.users).orderBy(asc(S.users.name)), db.select().from(S.levels).orderBy(S.levels.minPoints)]);

  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del programa, datos del concesionario, usuarios y comunicaciones." />
      <div className="grid gap-6 xl:grid-cols-3">
        <form action={saveSettingsAction} className="space-y-6 xl:col-span-2">
          <Card title={<span className="flex items-center gap-2"><Coins className="size-4 text-amber-500" /> Reglas de acumulación</span>} subtitle="Cuántos pesos debe comprar el cliente para ganar 1 punto en cada categoría.">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="🏍️ Motos" hint="COP por punto"><input name="pesosPerPointMOTO" defaultValue={n(s.pesosPerPointMOTO)} className="input" /></Field>
              <Field label="⚙️ Repuestos" hint="COP por punto"><input name="pesosPerPointREPUESTOS" defaultValue={n(s.pesosPerPointREPUESTOS)} className="input" /></Field>
              <Field label="🪖 Accesorios" hint="COP por punto"><input name="pesosPerPointACCESORIOS" defaultValue={n(s.pesosPerPointACCESORIOS)} className="input" /></Field>
              <Field label="🔧 Taller" hint="COP por punto"><input name="pesosPerPointTALLER" defaultValue={n(s.pesosPerPointTALLER)} className="input" /></Field>
            </div>
            <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              Ejemplo: una moto de $10.000.000 da <b>{n(Math.floor(10000000 / s.pesosPerPointMOTO))} pts</b>; un mantenimiento de $150.000 da <b>{n(Math.floor(150000 / s.pesosPerPointTALLER))} pts</b>. Un punto vale ≈ ${s.pointValueCOP} al canjear, así que el programa devuelve ≈{" "}
              <b>{((s.pointValueCOP / s.pesosPerPointREPUESTOS) * 100).toFixed(1)}%</b> en repuestos y <b>{((s.pointValueCOP / s.pesosPerPointMOTO) * 100).toFixed(1)}%</b> en motos.
            </p>
          </Card>
          <Card title="Bonos y vigencia">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Bono de bienvenida" hint="Puntos al inscribirse"><input name="welcomeBonus" defaultValue={s.welcomeBonus} className="input" /></Field>
              <Field label="Bono por referido" hint="Cuando el referido compra moto"><input name="referralBonus" defaultValue={s.referralBonus} className="input" /></Field>
              <Field label="Bono de cumpleaños" hint="Una vez al año"><input name="birthdayBonus" defaultValue={s.birthdayBonus} className="input" /></Field>
              <Field label="Valor de 1 punto (COP)" hint="Para calcular el pasivo"><input name="pointValueCOP" defaultValue={s.pointValueCOP} className="input" /></Field>
              <Field label="Vencimiento de puntos" hint="Meses sin compras (0 = nunca)"><input name="expirationMonths" defaultValue={s.expirationMonths} className="input" /></Field>
              <Field label="Cliente inactivo tras" hint="Días sin compras"><input name="inactiveDays" defaultValue={s.inactiveDays} className="input" /></Field>
              <Field label="Aviso de mantenimiento" hint="Días de anticipación"><input name="reminderLeadDays" defaultValue={s.reminderLeadDays} className="input" /></Field>
            </div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Store className="size-4 text-brand-700" /> Datos del concesionario</span>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre"><input name="businessName" defaultValue={s.businessName} className="input" /></Field>
              <Field label="WhatsApp del concesionario" hint="Ej: 573001234567"><input name="businessPhone" defaultValue={s.businessPhone} className="input" /></Field>
              <Field label="Dirección"><input name="businessAddress" defaultValue={s.businessAddress} className="input" /></Field>
            </div>
          </Card>
          <div className="flex justify-end"><SubmitButton className="btn btn-primary px-6">Guardar configuración</SubmitButton></div>
        </form>

        <div className="space-y-6">
          <Card id="usuarios" title={<span className="flex items-center gap-2"><Users className="size-4" /> Usuarios del personal</span>} actions={<Modal title="Nuevo usuario" trigger={<Plus className="size-4" />} triggerClassName="btn btn-secondary btn-sm"><UserForm /></Modal>} padded={false}>
            <ul className="divide-y divide-slate-100">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.name} {!u.active && <Badge>Inactivo</Badge>}</p>
                    <p className="truncate text-xs text-slate-500">{u.email} · {ROLES[u.role]}</p>
                    <p className="text-[11px] text-slate-400">Último ingreso: {dateTime(u.lastLoginAt)}</p>
                  </div>
                  <Modal title="Editar usuario" trigger={<Edit3 className="size-4" />} triggerClassName="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><UserForm u={u} /></Modal>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Bell className="size-4 text-violet-600" /> Notificación a clientes</span>} subtitle="Aparece en el portal de los clientes que aceptan promociones.">
            <form action={broadcastNotification} className="space-y-3">
              <input name="title" required className="input" placeholder="Título · Ej: ¡Doble puntos en repuestos!" />
              <textarea name="body" required rows={3} className="input" placeholder="Mensaje" />
              <select name="levelId" className="input"><option value="">Todos los niveles</option>{levels.map((l) => <option key={l.id} value={l.id}>Solo nivel {l.name}</option>)}</select>
              <SubmitButton className="btn btn-primary w-full" confirm="¿Enviar esta notificación a los clientes?">Enviar notificación</SubmitButton>
            </form>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Clock className="size-4" /> Tareas automáticas</span>}>
            <p className="text-sm text-slate-600">Abona bonos de cumpleaños del día y vence puntos de clientes sin compras en {s.expirationMonths} meses. En producción se ejecuta sola cada día con <code className="text-xs">/api/cron</code>.</p>
            <form action={runJobsAction} className="mt-3"><SubmitButton className="btn btn-secondary w-full" pendingText="Ejecutando…">Ejecutar ahora</SubmitButton></form>
          </Card>
        </div>
      </div>
    </>
  );
}
