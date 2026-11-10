import Link from "next/link";
import { Suspense } from "react";
import { Flash } from "./client";
import { Brand } from "./brand";

export function PortalAuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 via-brand-800 to-brand-700">
      <Suspense><Flash /></Suspense>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <div className="flex justify-center"><Brand dark /></div>
        <div className="mt-10 text-center text-white">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-brand-100">{subtitle}</p>
        </div>
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-2xl">{children}</div>
        <p className="mt-auto pt-8 text-center text-xs text-brand-200">Club de Fidelización Suzuki Melgar · <Link href="/admin/login" className="underline">Acceso personal</Link></p>
      </div>
    </div>
  );
}
