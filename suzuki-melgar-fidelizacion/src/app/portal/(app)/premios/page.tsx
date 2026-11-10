import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { pts, REWARD_CATEGORIES } from "@/lib/format";
import { SubmitButton } from "@/components/client";
import { Progress } from "@/components/ui";
import { requestRedemption } from "../../actions";

export const metadata = { title: "Premios" };

export default async function Premios({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const c = await requireCustomer();
  const { cat } = await searchParams;
  const rewards = await db.query.rewards.findMany({ where: eq(S.rewards.active, true), orderBy: asc(S.rewards.pointsCost), with: { minLevel: true } });
  const list = rewards.filter((r) => !cat || r.category === cat);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de premios</h1>
          <p className="text-sm text-slate-500">Tienes <b className="text-brand-700">{pts(c.pointsBalance)} puntos</b> para canjear</p>
        </div>
        <Link href="/portal/canjes" className="text-sm font-semibold text-brand-700">Mis canjes →</Link>
      </div>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/portal/premios" className={`chip shrink-0 ${!cat ? "chip-active" : ""}`}>Todos</Link>
        {Object.entries(REWARD_CATEGORIES).map(([k, v]) => <Link key={k} href={`?cat=${k}`} className={`chip shrink-0 ${cat === k ? "chip-active" : ""}`}>{v}</Link>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => {
          const lockedLevel = r.minLevel && (c.level?.minPoints ?? 0) < r.minLevel.minPoints;
          const soldOut = r.stock !== null && r.stock <= 0;
          const can = c.pointsBalance >= r.pointsCost && !lockedLevel && !soldOut;
          const pct = Math.min(100, Math.round((c.pointsBalance / r.pointsCost) * 100));
          return (
            <div key={r.id} className="card flex flex-col overflow-hidden">
              <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-6xl">
                {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : r.emoji}
                {r.minLevel && <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: r.minLevel.color }}>★ {r.minLevel.name}+</span>}
                {r.stock !== null && r.stock <= 5 && r.stock > 0 && <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">¡Quedan {r.stock}!</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold text-slate-900">{r.name}</p>
                <p className="mt-1 flex-1 text-sm text-slate-500">{r.description}</p>
                <p className="mt-3 text-2xl font-extrabold text-brand-800">{pts(r.pointsCost)} <span className="text-sm font-medium text-slate-500">puntos</span></p>
                {can ? (
                  <form action={requestRedemption} className="mt-3">
                    <input type="hidden" name="rewardId" value={r.id} />
                    <SubmitButton className="btn btn-accent w-full" pendingText="Canjeando…" confirm={`¿Canjear "${r.name}" por ${r.pointsCost.toLocaleString("es-CO")} puntos?`}>Canjear ahora</SubmitButton>
                  </form>
                ) : (
                  <div className="mt-3">
                    {!lockedLevel && !soldOut && <><Progress value={pct} /><p className="mt-1.5 text-xs text-slate-500">Te faltan {pts(r.pointsCost - c.pointsBalance)} puntos</p></>}
                    {lockedLevel && <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Lock className="size-3.5" /> Exclusivo nivel {r.minLevel!.name} o superior</p>}
                    {soldOut && <p className="text-xs font-medium text-slate-500">Agotado por ahora</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
