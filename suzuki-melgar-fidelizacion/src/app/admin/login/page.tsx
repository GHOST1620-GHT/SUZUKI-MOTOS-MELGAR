import { Flash, SubmitButton } from "@/components/client";
import { Brand } from "@/components/brand";
import { staffLogin } from "../auth-actions";
import { Suspense } from "react";

export const metadata = { title: "Ingreso del personal" };

export default function StaffLogin() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <Suspense><Flash /></Suspense>
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#2952d9_0,transparent_45%),radial-gradient(circle_at_80%_80%,#e30613_0,transparent_35%)] opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Brand dark />
          <div>
            <h2 className="text-4xl font-bold leading-tight">Club de Fidelización<br />Suzuki Melgar</h2>
            <p className="mt-4 max-w-md text-lg text-brand-100">Registra compras, premia a tus clientes, controla mantenimientos y haz que cada moto vuelva a nuestro taller.</p>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
              {[["Puntos", "por cada compra"], ["Niveles", "Bronce a Platino"], ["WhatsApp", "recordatorios"]].map(([a, b]) => (
                <div key={a} className="rounded-xl bg-white/10 p-4 backdrop-blur">
                  <p className="font-bold">{a}</p>
                  <p className="text-xs text-brand-100">{b}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-brand-200">© {new Date().getFullYear()} Suzuki Melgar · Melgar, Tolima</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <h1 className="text-2xl font-bold text-slate-900">Ingreso del personal</h1>
          <p className="mt-1 text-sm text-slate-500">Panel administrativo del programa de fidelización.</p>
          <form action={staffLogin} className="mt-8 space-y-4">
            <label className="block">
              <span className="label">Correo electrónico</span>
              <input className="input" type="email" name="email" required autoComplete="username" placeholder="usuario@suzukimelgar.com" />
            </label>
            <label className="block">
              <span className="label">Contraseña</span>
              <input className="input" type="password" name="password" required autoComplete="current-password" placeholder="••••••••" />
            </label>
            <SubmitButton className="btn btn-primary w-full py-3" pendingText="Ingresando…">Ingresar</SubmitButton>
          </form>
          <div className="mt-6 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            <b>Demo:</b> admin@suzukimelgar.com / admin123
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            ¿Eres cliente? <a className="font-semibold text-brand-700 hover:underline" href="/portal/login">Ingresa al portal</a>
          </p>
        </div>
      </div>
    </div>
  );
}
