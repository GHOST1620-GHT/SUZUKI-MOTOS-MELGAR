"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Bike, Cog, FileUp, Gift, LayoutDashboard, LogOut, Menu, PlusCircle, Receipt, Settings2, Ticket, Trophy, UserPlus, Users, Wrench, X,
} from "lucide-react";
import { Brand } from "./brand";

const NAV = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, roles: ["ADMIN", "ASESOR", "TALLER"] },
  { href: "/admin/compras/nueva", label: "Registrar compra", icon: PlusCircle, roles: ["ADMIN", "ASESOR", "TALLER"], highlight: true },
  { section: "Gestión" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, roles: ["ADMIN", "ASESOR", "TALLER"] },
  { href: "/admin/motos", label: "Motos", icon: Bike, roles: ["ADMIN", "ASESOR", "TALLER"] },
  { href: "/admin/compras", label: "Compras y puntos", icon: Receipt, roles: ["ADMIN", "ASESOR", "TALLER"] },
  { href: "/admin/mantenimientos", label: "Mantenimientos", icon: Wrench, roles: ["ADMIN", "ASESOR", "TALLER"], badge: "maint" },
  { href: "/admin/canjes", label: "Canjes", icon: Ticket, roles: ["ADMIN", "ASESOR", "TALLER"], badge: "redeem" },
  { href: "/admin/referidos", label: "Referidos", icon: UserPlus, roles: ["ADMIN", "ASESOR"], badge: "refs" },
  { section: "Programa" },
  { href: "/admin/premios", label: "Catálogo de premios", icon: Gift, roles: ["ADMIN", "ASESOR"] },
  { href: "/admin/niveles", label: "Niveles", icon: Trophy, roles: ["ADMIN"] },
  { href: "/admin/importar", label: "Importar MasControl", icon: FileUp, roles: ["ADMIN", "ASESOR"] },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2, roles: ["ADMIN"] },
] as const;

type Counts = { maint: number; redeem: number; refs: number };

export function AdminNav({ user, counts, logout }: { user: { name: string; role: string; roleLabel: string }; counts: Counts; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : href === "/admin/compras" ? pathname === "/admin/compras" : pathname.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Brand />
        <button className="rounded-lg p-1 text-slate-500 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV.map((item, i) => {
          if ("section" in item) return <p key={i} className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.section}</p>;
          if (!(item.roles as readonly string[]).includes(user.role)) return null;
          const Icon = item.icon;
          const active = isActive(item.href);
          const count = "badge" in item ? counts[item.badge as keyof Counts] : 0;
          if ("highlight" in item)
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="my-2 flex items-center gap-3 rounded-xl bg-accent-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600">
                <Icon className="size-[18px]" /> {item.label}
              </Link>
            );
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              <Icon className={`size-[18px] ${active ? "text-brand-700" : "text-slate-400"}`} />
              <span className="flex-1">{item.label}</span>
              {count > 0 && <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
            </Link>
          );
        })}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.roleLabel}</p>
          </div>
          <form action={logout}>
            <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Cerrar sesión">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{nav}</aside>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
        <Brand compact />
        <Link href="/admin/configuracion" className="rounded-lg p-2 text-slate-600" aria-label="Configuración">
          <Cog className="size-5" />
        </Link>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
