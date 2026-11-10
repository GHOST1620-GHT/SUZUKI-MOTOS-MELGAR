import type { Motorcycle } from "@/db/schema";
import { toInputDate } from "@/lib/format";
import { registerService, saveMotorcycle } from "@/app/admin/actions";
import { MoneyInput, SubmitButton } from "./client";
import { ModelList } from "./customer-form";
import { Field } from "./ui";

export const SERVICE_TYPES = ["Mantenimiento preventivo", "Cambio de aceite", "Revisión de garantía", "Sincronización", "Frenos", "Kit de arrastre", "Sistema eléctrico", "Llantas", "Reparación general", "Alistamiento / entrega"];

export function ServiceForm({ moto, back }: { moto: Motorcycle; back: string }) {
  return (
    <form action={registerService} className="space-y-4">
      <input type="hidden" name="motorcycleId" value={moto.id} />
      <input type="hidden" name="back" value={back} />
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <b className="text-slate-800">{moto.brand} {moto.model}</b> · {moto.plate ?? "sin placa"} · último registro {moto.currentKm.toLocaleString("es-CO")} km
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de servicio">
          <select name="type" className="input">{SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Kilometraje actual *"><input name="km" required className="input" inputMode="numeric" defaultValue={moto.currentKm || ""} /></Field>
        <Field label="Fecha"><input name="date" type="date" className="input" defaultValue={toInputDate(new Date())} /></Field>
        <Field label="Factura MasControl"><input name="invoiceNumber" className="input" placeholder="FV-0000" /></Field>
        <Field label="Valor del servicio" hint="Si tiene valor, el cliente gana puntos de taller." className="sm:col-span-2"><MoneyInput name="amount" /></Field>
        <Field label="Observaciones del técnico" className="sm:col-span-2"><textarea name="notes" rows={2} className="input" /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>Registrar servicio</SubmitButton></div>
    </form>
  );
}

export function MotoForm({ customerId, moto }: { customerId: string; moto?: Motorcycle }) {
  return (
    <form action={saveMotorcycle} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      {moto && <input type="hidden" name="id" value={moto.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marca"><input name="brand" className="input" defaultValue={moto?.brand ?? "Suzuki"} /></Field>
        <Field label="Modelo *" className="sm:col-span-2"><input name="model" required list="modelos" className="input" defaultValue={moto?.model} /></Field>
        <Field label="Placa"><input name="plate" className="input uppercase" defaultValue={moto?.plate ?? ""} /></Field>
        <Field label="Año"><input name="year" inputMode="numeric" className="input" defaultValue={moto?.year ?? ""} /></Field>
        <Field label="Color"><input name="color" className="input" defaultValue={moto?.color ?? ""} /></Field>
        <Field label="VIN / chasis" className="sm:col-span-2"><input name="vin" className="input uppercase" defaultValue={moto?.vin ?? ""} /></Field>
        <Field label="Fecha de compra"><input name="purchaseDate" type="date" className="input" defaultValue={toInputDate(moto?.purchaseDate)} /></Field>
        <Field label="Km actual"><input name="currentKm" inputMode="numeric" className="input" defaultValue={moto?.currentKm ?? 0} /></Field>
        <Field label="Km promedio / mes" hint="Para proyectar el mantenimiento"><input name="avgKmPerMonth" inputMode="numeric" className="input" defaultValue={moto?.avgKmPerMonth ?? 800} /></Field>
        <div />
        <Field label="Mantenimiento cada (km)"><input name="serviceIntervalKm" inputMode="numeric" className="input" defaultValue={moto?.serviceIntervalKm ?? 3000} /></Field>
        <Field label="o cada (días)"><input name="serviceIntervalDays" inputMode="numeric" className="input" defaultValue={moto?.serviceIntervalDays ?? 120} /></Field>
      </div>
      <ModelList />
      <div className="flex justify-end"><SubmitButton>{moto ? "Guardar cambios" : "Agregar moto"}</SubmitButton></div>
    </form>
  );
}
