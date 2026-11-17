import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { Bell, CheckCircle2, Circle, Clock, Coins, Edit3, Plus, Rocket, Store, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { dateTime, ROLES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { User } from "@/db/schema";
import { Modal, SubmitButton } from "@/components/client";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { broadcastNotification, resetOperationalData, runJobsAction, saveSettingsAction, saveUser } from "../../actions";

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
  const [users, levels, demoCustomer] = await Promise.all([
    db.select().from(S.users).orderBy(asc(S.users.name)),
    db.select().from(S.levels).orderBy(S.levels.minPoints),
    db.query.customers.findFirst({ where: eq(S.customers.document, "1234567890") }),
  ]);
  // Usuarios de prueba que siguen activos con su contraseña de demostración
  const DEMO: Record<string, string> = { "admin@suzukimelgar.com": "admin123", "asesor@suzukimelgar.com": "asesor123", "taller@suzukimelgar.com": "taller123" };
  const demoUsers = users.filter((u) => u.active && DEMO[u.email] && bcrypt.compareSync(DEMO[u.email], u.passwordHash));
  const realAdmins = users.filter((u) => u.active && u.role === "ADMIN" && !DEMO[u.email]);
  const steps = [
    { done: realAdmins.length > 0, title: "Crear el usuario administrador real", text: "En “Usuarios del personal” (+) cree el usuario del dueño o gerente con rol Administrador y una contraseña segura. Luego cierre sesión y entre con ese usuario." },
    { done: demoUsers.length === 0, title: "Desactivar los usuarios de prueba", text: demoUsers.length ? `Siguen activos con contraseña de prueba: ${demoUsers.map((u) => u.email).join(", ")}. Edítelos y desmarque “Usuario activo”.` : "Ningún usuario de prueba está activo." },
    { done: s.businessPhone !== "573000000000", title: "Configurar el WhatsApp del concesionario", text: "En “Datos del concesionario”, escriba el número con 57 adelante (ej: 573001234567). Es el número al que los clientes escriben para agendar." },
    { done: !demoCustomer, title: "Borrar los datos de prueba", text: "Elimina los 48 clientes de ejemplo con sus motos, compras, puntos y canjes. Se conservan usuarios, niveles, premios y configuración." },
  ];
  const pending = steps.filter((x) => !x.done).length;

  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del programa, datos del concesionario, usuarios y comunicaciones." />
      <Card
        className={`mb-6 ${pending ? "border-amber-300" : "border-emerald-300"}`}
        title={<span className="flex items-center gap-2"><Rocket className="size-4 text-accent-500" /> Puesta en marcha {pending ? <Badge tone="amber">{pending} pendiente{pending > 1 ? "s" : ""}</Badge> : <Badge tone="green">Listo para operar</Badge>}</span>}
        subtitle="Pasos para empezar a usar el sistema con clientes reales."
      >
        <ol className="grid gap-3 md:grid-cols-2">
          {steps.map((st, i) => (
            <li key={st.title} className={`flex gap-3 rounded-xl border p-4 ${st.done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}>
              {st.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />}
              <div>
                <p className={`text-sm font-semibold ${st.done ? "text-emerald-800" : "text-slate-800"}`}>{i + 1}. {st.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{st.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <form action={resetOperationalData} className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="label text-red-800">Borrar datos de prueba</span>
            <span className="mb-2 block text-xs text-red-700">Borra TODOS los clientes, motos, compras, puntos, canjes, referidos y mensajes. No se puede deshacer. Escriba <b>BORRAR TODO</b> para confirmar.</span>
            <input name="confirm" required autoComplete="off" className="input border-red-300" placeholder="BORRAR TODO" />
          </label>
          <SubmitButton className="btn btn-danger" pendingText="Borrando…" confirm="¿Seguro? Se borrarán todos los clientes y su historial. Esta acción no se puede deshacer.">Borrar datos de prueba</SubmitButton>
        </form>
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <form action={saveSettingsAction} className="space-y-6 xl:col-span-2">
          <Card title={<span className="flex items-center gap-2"><Coins className="size-4 text-amber-500" /> Reglas de acumulación</span>} subtitle="Cuántos pesos debe comprar el cliente para ganar 1 punto en cada categoría.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="🏍️ Motos" hint="COP por punto"><input name="pesosPerPointMOTO" defaultValue={n(s.pesosPerPointMOTO)} className="input" /></Field>
              <Field label="⚙️ Repuestos" hint="COP por punto"><input name="pesosPerPointREPUESTOS" defaultValue={n(s.pesosPerPointREPUESTOS)} className="input" /></Field>
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
