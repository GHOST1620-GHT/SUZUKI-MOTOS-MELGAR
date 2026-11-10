import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { PortalAuthShell } from "@/components/portal-shell";
import { customerLogin } from "../actions";

export const metadata = { title: "Ingresar · Portal de clientes" };

export default function PortalLogin() {
  return (
    <PortalAuthShell title="Hola, motero 👋" subtitle="Ingresa para ver tus puntos, premios y mantenimientos.">
      <form action={customerLogin} className="space-y-4">
        <label className="block">
          <span className="label">Número de cédula</span>
          <input name="document" required inputMode="numeric" autoComplete="username" className="input py-3 text-base" placeholder="1234567890" />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input name="password" type="password" required autoComplete="current-password" className="input py-3 text-base" placeholder="••••••" />
        </label>
        <SubmitButton className="btn btn-primary w-full py-3.5 text-base" pendingText="Ingresando…">Ingresar</SubmitButton>
      </form>
      <div className="mt-6 rounded-xl bg-brand-50 p-4 text-center text-sm text-brand-900">
        ¿Primera vez? <Link href="/portal/activar" className="font-bold underline">Activa tu cuenta</Link> con tu cédula y el celular que registraste en el concesionario.
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Demo: cédula 1234567890 · contraseña cliente123</p>
    </PortalAuthShell>
  );
}
