"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bike, Gift, History, Home, User } from "lucide-react";
import { Brand } from "./brand";

const ITEMS = [
  { href: "/portal", label: "Inicio", icon: Home },
  { href: "/portal/premios", label: "Premios", icon: Gift },
  { href: "/portal/motos", label: "Mis motos", icon: Bike },
  { href: "/portal/historial", label: "Historial", icon: History },
  { href: "/portal/perfil", label: "Perfil", icon: User },
];

export function PortalNav({ unread, name }: { unread: number; name: string }) {
  const path = usePathname();
  const active = (h: string) => (h === "/portal" ? path === "/portal" : path.startsWith(h));
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/portal"><Brand /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {ITEMS.map((i) => (
              <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-2 text-sm font-medium ${active(i.href) ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100"}`}>{i.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 lg:inline">Hola, <b>{name}</b></span>
            <Link href="/portal/notificaciones" className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Notificaciones">
              <Bell className="size-5" />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 flex size-4.5 min-w-[18px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {ITEMS.map((i) => {
            const Icon = i.icon;
            const on = active(i.href);
            return (
              <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${on ? "text-brand-700" : "text-slate-500"}`}>
                <Icon className={`size-5 ${on ? "stroke-[2.4]" : ""}`} />
                {i.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
