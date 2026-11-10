import type { Customer } from "@/db/schema";
import { toInputDate } from "@/lib/format";
import { Field } from "./ui";

/** Campos del cliente, compartidos por "nuevo" y "editar". */
export function CustomerFields({ c }: { c?: Customer }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field label="Tipo doc." className="sm:col-span-1">
        <select name="documentType" defaultValue={c?.documentType ?? "CC"} className="input">
          <option value="CC">CC</option>
          <option value="CE">CE</option>
          <option value="NIT">NIT</option>
          <option value="PP">Pasaporte</option>
          <option value="TI">TI</option>
        </select>
      </Field>
      <Field label="Número de documento *" className="sm:col-span-2">
        <input name="document" defaultValue={c?.document} required className="input" inputMode="numeric" placeholder="1234567890" />
      </Field>
      <Field label="Nombres *" className="sm:col-span-3">
        <input name="firstName" defaultValue={c?.firstName} required className="input" />
      </Field>
      <Field label="Apellidos *" className="sm:col-span-3">
        <input name="lastName" defaultValue={c?.lastName} required className="input" />
      </Field>
      <Field label="Celular (WhatsApp) *" className="sm:col-span-3">
        <input name="phone" defaultValue={c?.phone} required className="input" inputMode="tel" placeholder="300 123 4567" />
      </Field>
      <Field label="Correo electrónico" className="sm:col-span-3">
        <input name="email" type="email" defaultValue={c?.email ?? ""} className="input" />
      </Field>
      <Field label="Fecha de nacimiento" hint="Para el bono de cumpleaños" className="sm:col-span-3">
        <input name="birthDate" type="date" defaultValue={toInputDate(c?.birthDate)} className="input" />
      </Field>
      <Field label="Ciudad / municipio" className="sm:col-span-2">
        <input name="city" defaultValue={c?.city ?? "Melgar"} className="input" />
      </Field>
      <Field label="Dirección" className="sm:col-span-4">
        <input name="address" defaultValue={c?.address ?? ""} className="input" />
      </Field>
      <Field label="Notas internas" className="sm:col-span-6">
        <textarea name="notes" defaultValue={c?.notes ?? ""} rows={2} className="input" placeholder="Preferencias, observaciones del asesor…" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-6">
        <input type="checkbox" name="acceptsMarketing" defaultChecked={c?.acceptsMarketing ?? true} className="size-4 rounded border-slate-300 text-brand-700" />
        Acepta recibir promociones y recordatorios (Ley 1581 de 2012 – Habeas Data)
      </label>
    </div>
  );
}

export function ModelList() {
  const models = ["Gixxer 150 FI", "Gixxer 250 SF", "GN 125", "DR 150 FI", "AX4 115", "Best 125", "Viva R Style", "V-Strom 250 SX", "V-Strom 800 DE", "Burgman Street 125", "Avenis 125", "DR 650", "GSX-S750", "GSX-8S", "Hayabusa"];
  return (
    <datalist id="modelos">
      {models.map((m) => <option key={m} value={m} />)}
    </datalist>
  );
}
