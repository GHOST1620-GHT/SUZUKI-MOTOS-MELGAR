import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/client";
import { CustomerFields, ModelList } from "@/components/customer-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { createCustomer } from "../../../actions";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoCliente() {
  await requireStaff();
  const s = await getSettings();
  return (
    <form action={createCustomer} className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo cliente" subtitle={`Al registrarlo recibe ${s.welcomeBonus} puntos de bienvenida.`} back={{ href: "/admin/clientes", label: "Clientes" }} />
      <div className="space-y-6">
        <Card title="Datos personales">
          <CustomerFields />
        </Card>
        <Card title="Moto (opcional)" subtitle="Puede agregar más motos después desde la ficha del cliente.">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Modelo" className="sm:col-span-2"><input name="motoModel" className="input" placeholder="Gixxer 150 FI" list="modelos" /></Field>
            <Field label="Placa"><input name="motoPlate" className="input uppercase" placeholder="ABC12D" /></Field>
            <Field label="Año"><input name="motoYear" className="input" inputMode="numeric" placeholder={String(new Date().getFullYear())} /></Field>
            <Field label="Fecha de compra" className="sm:col-span-2"><input name="motoPurchaseDate" type="date" className="input" /></Field>
            <Field label="Kilometraje actual" className="sm:col-span-2"><input name="motoKm" className="input" inputMode="numeric" placeholder="0" /></Field>
          </div>
          <ModelList />
        </Card>
        <Card title="Referido por (opcional)">
          <Field label="Código de referido" hint="Si un cliente lo recomendó, ingrese su código. Cuando compre su moto, quien lo refirió gana puntos.">
            <input name="referralCode" className="input uppercase sm:max-w-xs" placeholder="ANDRE1234" />
          </Field>
        </Card>
        <div className="flex justify-end gap-2">
          <a href="/admin/clientes" className="btn btn-secondary">Cancelar</a>
          <SubmitButton>Registrar cliente</SubmitButton>
        </div>
      </div>
    </form>
  );
}
