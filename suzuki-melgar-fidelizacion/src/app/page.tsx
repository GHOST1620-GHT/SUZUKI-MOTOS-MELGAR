import Link from "next/link";
import { Gift, ShieldCheck, Trophy, Wrench } from "lucide-react";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Brand dark />
          <Link href="/admin/login" className="text-sm text-brand-100 hover:text-white">Acceso personal →</Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-brand-100 ring-1 ring-white/20">Club de Fidelización</span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">Tu moto te da <span className="text-yellow-300">más</span> en Suzuki Melgar</h1>
          <p className="mt-5 max-w-xl text-lg text-brand-100">Acumula puntos en cada compra, repuesto y servicio de taller. Canjéalos por premios, sube de nivel y nunca olvides un mantenimiento.</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/portal/login" className="btn bg-accent-500 px-8 py-4 text-base text-white hover:bg-accent-600">Soy cliente · Ver mis puntos</Link>
            <Link href="/portal/activar" className="btn bg-white/10 px-8 py-4 text-base text-white ring-1 ring-white/30 hover:bg-white/20">Activar mi cuenta</Link>
          </div>
          <div className="mt-16 grid w-full gap-4 sm:grid-cols-4">
            {[
              [Gift, "Premios", "Lavadas, aceite, accesorios y experiencias"],
              [Trophy, "Niveles", "Bronce, Plata, Oro y Platino con más beneficios"],
              [Wrench, "Mantenimiento", "Te avisamos cuándo le toca a tu moto"],
              [ShieldCheck, "Referidos", "Gana puntos cuando tus amigos compran"],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Gift;
              return (
                <div key={t as string} className="rounded-2xl bg-white/10 p-5 text-left ring-1 ring-white/10 backdrop-blur">
                  <I className="size-6 text-yellow-300" />
                  <p className="mt-3 font-bold">{t as string}</p>
                  <p className="mt-1 text-sm text-brand-100">{d as string}</p>
                </div>
              );
            })}
          </div>
        </main>
        <footer className="text-center text-xs text-brand-200">© {new Date().getFullYear()} Suzuki Melgar · Melgar, Tolima</footer>
      </div>
    </div>
  );
}
