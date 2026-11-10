import Link from "next/link";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { ChevronRight, Gift, History, Sparkles, Ticket, UserPlus, Wrench } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts, relative } from "@/lib/format";
import { getLevelProgress, maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { MemberCard } from "@/components/member-card";
import { WhatsAppButton } from "@/components/client";
import { Progress } from "@/components/ui";

export const metadata = { title: "Mi Club" };

export default async function PortalHome() {
  const c = await requireCustomer();
  const s = await getSettings();
  const [progress, motos, notes, open, affordable] = await Promise.all([
    getLevelProgress(c.lifetimePoints),
    db.select().from(S.motorcycles).where(eq(S.motorcycles.customerId, c.id)),
    db.select().from(S.notifications).where(eq(S.notifications.customerId, c.id)).orderBy(desc(S.notifications.createdAt)).limit(3),
    db.query.redemptions.findMany({ where: and(eq(S.redemptions.customerId, c.id), inArray(S.redemptions.status, ["PENDIENTE", "APROBADO"])), with: { reward: true } }),
    db.select().from(S.rewards).where(and(eq(S.rewards.active, true), lte(S.rewards.pointsCost, Math.max(c.pointsBalance, 0) + 1000))).orderBy(asc(S.rewards.pointsCost)).limit(12),
  ]);
  const rewardsShow = affordable.filter((r) => r.stock === null || r.stock > 0).sort((a, b) => b.pointsCost - a.pointsCost).slice(0, 4);
  const maint = motos.map((m) => ({ m, st: maintenanceStatus(m, s.reminderLeadDays) })).sort((a, b) => a.st.daysLeft - b.st.daysLeft);
  const level = c.level ?? progress.current;

  return (
    <div className="space-y-5">
      <MemberCard name={`${c.firstName} ${c.lastName}`} level={level?.name ?? ""} color={level?.color ?? "#0f2f9c"} points={c.pointsBalance} code={c.referralCode} document={c.document} since={String(c.createdAt.getFullYear())} />

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Tu camino al siguiente nivel</p>
          <Link href="/portal/perfil#niveles" className="text-xs font-semibold text-brand-700">Ver niveles</Link>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs font-semibold">
          <span style={{ color: level?.color }}>★ {level?.name}</span>
          {progress.next && <span style={{ color: progress.next.color }}>★ {progress.next.name}</span>}
        </div>
        <Progress value={progress.progress} color={progress.next?.color ?? level?.color} className="mt-1.5 h-3" />
        <p className="mt-2 text-sm text-slate-600">
          {progress.next ? <>Te faltan <b className="text-slate-900">{pts(progress.missing)} puntos</b> para ser {progress.next.name} y ganar puntos x{progress.next.multiplier}.</> : <>¡Estás en el nivel más alto! Disfruta todos los beneficios. 🏆</>}
        </p>
      </div>

      {open.length > 0 && (
        <Link href="/portal/canjes" className="card flex items-center gap-4 border-violet-200 bg-violet-50 p-4">
          <Ticket className="size-6 text-violet-600" />
          <div className="flex-1">
            <p className="font-semibold text-violet-900">Tienes {open.length} premio{open.length > 1 ? "s" : ""} por reclamar</p>
            <p className="text-xs text-violet-700">{open.map((o) => o.reward.name).join(" · ")}</p>
          </div>
          <ChevronRight className="size-5 text-violet-400" />
        </Link>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { href: "/portal/premios", icon: Gift, label: "Canjear", tone: "bg-accent-500" },
          { href: "/portal/motos", icon: Wrench, label: "Mis motos", tone: "bg-orange-500" },
          { href: "/portal/referidos", icon: UserPlus, label: "Referir", tone: "bg-violet-600" },
          { href: "/portal/historial", icon: History, label: "Historial", tone: "bg-cyan-600" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="card flex flex-col items-center gap-2 p-3 text-center hover:shadow-md">
            <span className={`flex size-11 items-center justify-center rounded-2xl text-white ${a.tone}`}><a.icon className="size-5" /></span>
            <span className="text-xs font-semibold text-slate-700">{a.label}</span>
          </Link>
        ))}
      </div>

      {maint.length > 0 && (
        <div className="card p-5">
          <p className="font-semibold text-slate-900">Mantenimiento de tus motos</p>
          <div className="mt-3 space-y-3">
            {maint.map(({ m, st }) => (
              <div key={m.id} className={`flex items-center gap-3 rounded-2xl p-3 ${st.state === "VENCIDO" ? "bg-red-50" : st.state === "PROXIMO" ? "bg-amber-50" : "bg-emerald-50"}`}>
                <span className="text-2xl">{st.state === "AL_DIA" ? "✅" : "🔧"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.model} · {m.plate}</p>
                  <p className="text-xs text-slate-600">
                    {st.state === "VENCIDO" ? "¡Tu mantenimiento está vencido!" : st.state === "PROXIMO" ? `Mantenimiento en ${st.daysLeft} días` : `Próximo: ${date(st.dueDate)} o ${pts(st.nextKm)} km`}
                  </p>
                </div>
                {st.state !== "AL_DIA" && (
                  <WhatsAppButton href={waLink(s.businessPhone, `Hola, soy ${c.firstName} ${c.lastName} (CC ${c.document}). Quiero agendar el mantenimiento de mi ${m.model} placa ${m.plate ?? ""}.`)}>Agendar</WhatsAppButton>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rewardsShow.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="size-4 text-amber-500" /> Premios para ti</p>
            <Link href="/portal/premios" className="text-xs font-semibold text-brand-700">Ver todos</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rewardsShow.map((r) => {
              const can = c.pointsBalance >= r.pointsCost;
              return (
                <Link key={r.id} href="/portal/premios" className="card p-4 text-center hover:shadow-md">
                  <span className="text-4xl">{r.emoji}</span>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800">{r.name}</p>
                  <p className="mt-1 text-sm font-bold text-brand-700">{pts(r.pointsCost)} pts</p>
                  <p className={`mt-1 text-[11px] font-medium ${can ? "text-emerald-600" : "text-slate-400"}`}>{can ? "¡Ya puedes canjearlo!" : `Te faltan ${pts(r.pointsCost - c.pointsBalance)}`}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">Novedades</p>
            <Link href="/portal/notificaciones" className="text-xs font-semibold text-brand-700">Ver todas</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {notes.map((n) => (
              <li key={n.id} className="flex gap-3 py-3">
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" />}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{relative(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card bg-gradient-to-r from-violet-600 to-brand-700 p-5 text-white">
        <p className="text-lg font-bold">Refiere y gana {pts(s.referralBonus)} puntos 🎉</p>
        <p className="mt-1 text-sm text-white/80">Cuando un amigo compre su moto con tu código <b className="font-mono">{c.referralCode}</b>, te abonamos los puntos.</p>
        <Link href="/portal/referidos" className="btn mt-4 bg-white text-brand-800 hover:bg-brand-50">Referir a un amigo</Link>
      </div>
    </div>
  );
}
