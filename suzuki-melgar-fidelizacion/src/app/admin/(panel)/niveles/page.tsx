import { count, eq } from "drizzle-orm";
import { Edit3, Plus, Trophy } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { pts } from "@/lib/format";
import type { Level } from "@/db/schema";
import { Modal, SubmitButton } from "@/components/client";
import { Field, LevelBadge, PageHeader } from "@/components/ui";
import { deleteLevel, saveLevel } from "../../actions";

export const metadata = { title: "Niveles" };

function LevelForm({ l }: { l?: Level }) {
  return (
    <form action={saveLevel} className="space-y-4">
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *"><input name="name" required defaultValue={l?.name} className="input" /></Field>
        <Field label="Color"><input name="color" type="color" defaultValue={l?.color ?? "#64748b"} className="input h-[42px] p-1" /></Field>
        <Field label="Puntos históricos mínimos" hint="Puntos ganados en total (los canjes no bajan el nivel)"><input name="minPoints" inputMode="numeric" defaultValue={l?.minPoints ?? 0} className="input" /></Field>
        <Field label="Multiplicador de puntos" hint="1 = normal · 1.25 = +25%"><input name="multiplier" defaultValue={l?.multiplier ?? 1} className="input" /></Field>
        <Field label="Orden"><input name="sortOrder" inputMode="numeric" defaultValue={l?.sortOrder ?? 0} className="input" /></Field>
        <Field label="Beneficios (uno por línea)" className="sm:col-span-2"><textarea name="benefits" rows={4} defaultValue={l?.benefits} className="input" /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>Guardar nivel</SubmitButton></div>
    </form>
  );
}

export default async function Niveles() {
  await requireStaff(["ADMIN"]);
  const levels = await db.select({ l: S.levels, n: count(S.customers.id) }).from(S.levels).leftJoin(S.customers, eq(S.customers.levelId, S.levels.id)).groupBy(S.levels.id).orderBy(S.levels.minPoints);

  return (
    <>
      <PageHeader
        title="Niveles del programa"
        subtitle="El cliente sube de nivel automáticamente según los puntos que ha ganado en total. Cada nivel multiplica los puntos y da beneficios."
        actions={<Modal title="Nuevo nivel" trigger={<><Plus className="size-4" /> Nuevo nivel</>}><LevelForm /></Modal>}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {levels.map(({ l, n }, i) => (
          <div key={l.id} className="card overflow-hidden">
            <div className="relative p-5 text-white" style={{ background: `linear-gradient(135deg, ${l.color}, ${l.color}bb)` }}>
              <Trophy className="absolute right-4 top-4 size-10 opacity-20" />
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Nivel {i + 1}</p>
              <p className="text-2xl font-extrabold">{l.name}</p>
              <p className="mt-1 text-sm opacity-90">Desde {pts(l.minPoints)} pts</p>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Multiplicador</p><p className="text-lg font-bold">x{l.multiplier}</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Clientes</p><p className="text-lg font-bold">{n}</p></div>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {l.benefits.split("\n").filter(Boolean).map((b) => <li key={b} className="flex gap-2"><span className="text-emerald-500">✓</span>{b}</li>)}
              </ul>
              <div className="mt-5 flex justify-between gap-2 border-t border-slate-100 pt-4">
                <form action={deleteLevel}><input type="hidden" name="id" value={l.id} /><SubmitButton className="btn btn-ghost btn-sm text-red-600" pendingText="…" confirm={`¿Eliminar el nivel ${l.name}? Los clientes se reasignarán automáticamente.`}>Eliminar</SubmitButton></form>
                <Modal title={`Editar nivel ${l.name}`} trigger={<><Edit3 className="size-3.5" /> Editar</>} triggerClassName="btn btn-secondary btn-sm"><LevelForm l={l} /></Modal>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card mt-6 p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">¿Cómo funciona?</p>
        <p className="mt-1">Ejemplo: un cliente <LevelBadge level={levels[2]?.l} /> que compra $300.000 en repuestos gana 150 puntos base × {levels[2]?.l.multiplier ?? 1} = <b>{Math.floor(150 * (levels[2]?.l.multiplier ?? 1))} puntos</b>. Al cambiar los umbrales se recalcula el nivel de todos los clientes.</p>
      </div>
    </>
  );
}
