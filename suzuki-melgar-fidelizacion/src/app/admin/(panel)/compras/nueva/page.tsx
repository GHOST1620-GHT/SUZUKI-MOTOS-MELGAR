import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { CATEGORIES, pts, toInputDate } from "@/lib/format";
import { pesosPerPoint } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { MoneyInput, PointsPreview, ShowWhenCategory, SubmitButton } from "@/components/client";
import { CustomerPicker } from "@/components/customer-picker";
import { ModelList } from "@/components/customer-form";
import { SERVICE_TYPES } from "@/components/forms";
import { Avatar, Card, Field, LevelBadge, PageHeader } from "@/components/ui";
import { createPurchase } from "../../../actions";

export const metadata = { title: "Registrar compra" };

export default async function NuevaCompra({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requireStaff();
  const { cliente } = await searchParams;
  const s = await getSettings();
  const c = cliente ? await db.query.customers.findFirst({ where: eq(S.customers.id, cliente), with: { level: true, motorcycles: true } }) : null;
  const rates = Object.fromEntries((Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((k) => [k, pesosPerPoint(k, s)]));
  const defaultCat = user.role === "TALLER" ? "TALLER" : "REPUESTOS";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Registrar compra" subtitle="Suma puntos al cliente por compras de motos, repuestos, accesorios o servicios de taller." />

      {!c ? (
        <Card title="1. Buscar cliente">
          <CustomerPicker basePath="/admin/compras/nueva" />
          <p className="mt-3 text-xs text-slate-500">Consejo: use el lector de cédula o escriba la placa de la moto. ¿Cliente nuevo? <Link className="font-semibold text-brand-700" href="/admin/clientes/nuevo">Regístrelo aquí</Link>.</p>
        </Card>
      ) : (
        <form id="purchase-form" action={createPurchase} className="space-y-6">
          <input type="hidden" name="customerId" value={c.id} />
          <input type="hidden" name="back" value={`/admin/compras/nueva`} />
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={`${c.firstName} ${c.lastName}`} color={c.level?.color} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-900">{c.firstName} {c.lastName}</p>
                <p className="text-sm text-slate-500">CC {c.document} · {c.phone}</p>
              </div>
              <div className="text-right">
                <LevelBadge level={c.level} />
                <p className="mt-1 text-sm font-bold text-slate-800">{pts(c.pointsBalance)} pts</p>
              </div>
            </div>
            <Link href="/admin/compras/nueva" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Cambiar cliente</Link>
          </Card>

          <Card title="2. Detalle de la compra">
            <div className="space-y-5">
              <div>
                <span className="label">Categoría</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.entries(CATEGORIES) as [string, { label: string; color: string }][]).map(([k, v]) => (
                    <label key={k} className="cursor-pointer rounded-xl border-2 border-slate-200 p-3 text-center transition has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
                      <input type="radio" name="category" value={k} defaultChecked={k === defaultCat} className="sr-only" />
                      <span className="block text-2xl">{{ MOTO: "🏍️", REPUESTOS: "⚙️", ACCESORIOS: "🪖", TALLER: "🔧" }[k]}</span>
                      <span className="block text-sm font-semibold text-slate-800">{v.label}</span>
                      <span className="block text-[11px] text-slate-500">1 pt c/ ${rates[k].toLocaleString("es-CO")}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor total de la factura *"><MoneyInput name="amount" required /></Field>
                <Field label="N.º de factura MasControl" hint="Evita registrar la misma factura dos veces"><input name="invoiceNumber" className="input" placeholder="FV-10234" /></Field>
                <Field label="Fecha de compra"><input name="date" type="date" defaultValue={toInputDate(new Date())} className="input" /></Field>
                <Field label="Moto relacionada">
                  <select name="motorcycleId" className="input" defaultValue={c.motorcycles[0]?.id ?? ""}>
                    <option value="">— Ninguna —</option>
                    {c.motorcycles.map((m) => <option key={m.id} value={m.id}>{m.model} · {m.plate ?? "sin placa"}</option>)}
                  </select>
                </Field>
              </div>

              <ShowWhenCategory value="TALLER">
                <div className="grid gap-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:grid-cols-2">
                  <p className="text-sm font-semibold text-orange-800 sm:col-span-2">🔧 Datos del servicio (actualiza el control de mantenimiento)</p>
                  <Field label="Tipo de servicio"><select name="serviceType" className="input">{SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                  <Field label="Kilometraje al ingreso"><input name="serviceKm" inputMode="numeric" className="input" placeholder="Ej: 6.200" /></Field>
                </div>
              </ShowWhenCategory>
              <ShowWhenCategory value="MOTO">
                <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-3">
                  <p className="text-sm font-semibold text-blue-800 sm:col-span-3">🏍️ ¿Es una moto nueva? Regístrela aquí (deje en blanco si ya está en la lista)</p>
                  <Field label="Modelo"><input name="newMotoModel" list="modelos" className="input" /></Field>
                  <Field label="Placa"><input name="newMotoPlate" className="input uppercase" /></Field>
                  <Field label="Año"><input name="newMotoYear" inputMode="numeric" className="input" /></Field>
                  <ModelList />
                </div>
              </ShowWhenCategory>

              <Field label="Notas"><textarea name="notes" rows={2} className="input" placeholder="Opcional" /></Field>
              <PointsPreview rates={rates} multiplier={c.level?.multiplier ?? 1} />
            </div>
          </Card>
          <div className="flex justify-end gap-2">
            <Link href={`/admin/clientes/${c.id}`} className="btn btn-secondary">Ver ficha del cliente</Link>
            <SubmitButton className="btn btn-accent px-6">Registrar y sumar puntos</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
