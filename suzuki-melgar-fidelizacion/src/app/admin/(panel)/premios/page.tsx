import { asc, count, eq } from "drizzle-orm";
import { Edit3, Gift, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { pts, REWARD_CATEGORIES } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { Level, Reward } from "@/db/schema";
import { Modal, SubmitButton } from "@/components/client";
import { Badge, EmptyState, Field, PageHeader } from "@/components/ui";
import { saveReward, toggleReward } from "../../actions";

export const metadata = { title: "Catálogo de premios" };

function RewardForm({ r, levels }: { r?: Reward; levels: Level[] }) {
  return (
    <form action={saveReward} className="space-y-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Ícono"><input name="emoji" defaultValue={r?.emoji ?? "🎁"} className="input text-center text-xl" maxLength={4} /></Field>
        <Field label="Nombre del premio *" className="sm:col-span-3"><input name="name" required defaultValue={r?.name} className="input" /></Field>
        <Field label="Descripción" className="sm:col-span-4"><textarea name="description" rows={2} defaultValue={r?.description} className="input" /></Field>
        <Field label="Categoría" className="sm:col-span-2">
          <select name="category" defaultValue={r?.category ?? "ACCESORIO"} className="input">{Object.entries(REWARD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label="Costo en puntos *"><input name="pointsCost" required inputMode="numeric" defaultValue={r?.pointsCost} className="input" /></Field>
        <Field label="Stock" hint="Vacío = ilimitado"><input name="stock" inputMode="numeric" defaultValue={r?.stock ?? ""} className="input" /></Field>
        <Field label="Exclusivo desde nivel" className="sm:col-span-2">
          <select name="minLevelId" defaultValue={r?.minLevelId ?? ""} className="input"><option value="">Todos los niveles</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        </Field>
        <Field label="URL de imagen (opcional)" className="sm:col-span-2"><input name="imageUrl" defaultValue={r?.imageUrl ?? ""} className="input" placeholder="https://…" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} className="size-4" /> Visible para los clientes</label>
      </div>
      <div className="flex justify-end"><SubmitButton>{r ? "Guardar cambios" : "Crear premio"}</SubmitButton></div>
    </form>
  );
}

export default async function Premios() {
  await requireStaff(["ADMIN", "ASESOR"]);
  const s = await getSettings();
  const [rewards, levels, counts] = await Promise.all([
    db.query.rewards.findMany({ orderBy: asc(S.rewards.pointsCost), with: { minLevel: true } }),
    db.select().from(S.levels).orderBy(S.levels.minPoints),
    db.select({ id: S.redemptions.rewardId, n: count() }).from(S.redemptions).where(eq(S.redemptions.status, "ENTREGADO")).groupBy(S.redemptions.rewardId),
  ]);
  const used = new Map(counts.map((c) => [c.id, c.n]));

  return (
    <>
      <PageHeader
        title="Catálogo de premios"
        subtitle={`Lo que los clientes pueden canjear con sus puntos. Referencia: 1 punto ≈ $${s.pointValueCOP} COP.`}
        actions={<Modal title="Nuevo premio" trigger={<><Plus className="size-4" /> Nuevo premio</>} size="lg"><RewardForm levels={levels} /></Modal>}
      />
      {rewards.length === 0 ? <EmptyState icon={Gift} title="Sin premios" text="Cree el primer premio del catálogo." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rewards.map((r) => (
            <div key={r.id} className={`card flex flex-col overflow-hidden ${r.active ? "" : "opacity-60"}`}>
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-5xl">
                {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : r.emoji}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  {!r.active && <Badge>Oculto</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">{r.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{REWARD_CATEGORIES[r.category]}</Badge>
                  {r.minLevel && <Badge tone="amber">★ {r.minLevel.name}+</Badge>}
                  <Badge tone={r.stock === 0 ? "red" : "gray"}>{r.stock === null ? "Stock ilimitado" : `${r.stock} disponibles`}</Badge>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xl font-extrabold text-brand-800">{pts(r.pointsCost)} <span className="text-xs font-medium text-slate-500">pts</span></p>
                    <p className="text-[11px] text-slate-400">{used.get(r.id) ?? 0} entregados · ≈ ${pts(r.pointsCost * s.pointValueCOP)}</p>
                  </div>
                  <div className="flex gap-1">
                    <form action={toggleReward}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm">{r.active ? "Ocultar" : "Activar"}</button></form>
                    <Modal title="Editar premio" trigger={<Edit3 className="size-3.5" />} triggerClassName="btn btn-secondary btn-sm" size="lg"><RewardForm r={r} levels={levels} /></Modal>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
