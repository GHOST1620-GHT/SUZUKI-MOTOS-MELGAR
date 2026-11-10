import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { PortalAuthShell } from "@/components/portal-shell";
import { activateAccount } from "../actions";

export const metadata = { title: "Activar cuenta" };

export default function Activar() {
  return (
    <PortalAuthShell title="Activa tu cuenta" subtitle="Valida tus datos y crea una contraseña para entrar al Club.">
      <form action={activateAccount} className="space-y-4">
        <label className="block"><span className="label">Número de cédula</span><input name="document" required inputMode="numeric" className="input py-3 text-base" /></label>
        <label className="block"><span className="label">Celular registrado en el concesionario</span><input name="phone" required inputMode="tel" className="input py-3 text-base" placeholder="300 123 4567" /></label>
        <label className="block"><span className="label">Crea una contraseña</span><input name="password" type="password" required minLength={6} className="input py-3 text-base" placeholder="Mínimo 6 caracteres" /></label>
        <label className="block"><span className="label">Repite la contraseña</span><input name="password2" type="password" required minLength={6} className="input py-3 text-base" /></label>
        <SubmitButton className="btn btn-primary w-full py-3.5 text-base" pendingText="Activando…">Activar y entrar</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">¿Ya tienes cuenta? <Link href="/portal/login" className="font-semibold text-brand-700">Ingresa aquí</Link></p>
      <p className="mt-3 text-center text-xs text-slate-400">¿Aún no estás inscrito? Pídelo en tu próxima visita: es gratis y recibes puntos de bienvenida.</p>
    </PortalAuthShell>
  );
}
