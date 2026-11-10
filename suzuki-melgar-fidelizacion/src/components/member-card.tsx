import { Bike } from "lucide-react";

/** Tarjeta de socio estilo tarjeta física, con el color del nivel. */
export function MemberCard({ name, level, color, points, code, document, since }: { name: string; level: string; color: string; points: number; code: string; document: string; since: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl" style={{ background: `linear-gradient(135deg, #0a1c57 0%, #0f2f9c 45%, ${color} 130%)` }}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-white/5" />
      <Bike className="pointer-events-none absolute -bottom-4 right-4 size-32 text-white/10" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Club Suzuki Melgar</p>
          <p className="mt-1 text-lg font-bold">{name}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider shadow" style={{ background: color }}>★ {level}</span>
      </div>
      <div className="relative mt-6">
        <p className="text-sm text-white/70">Puntos disponibles</p>
        <p className="text-5xl font-extrabold tracking-tight tabular-nums">{points.toLocaleString("es-CO")}</p>
      </div>
      <div className="relative mt-6 flex items-end justify-between text-xs text-white/80">
        <div>
          <p className="text-white/60">Socio</p>
          <p className="font-mono text-sm font-semibold tracking-wider">CC {document}</p>
        </div>
        <div className="text-right">
          <p className="text-white/60">Código referido · desde {since}</p>
          <p className="font-mono text-sm font-semibold tracking-wider">{code}</p>
        </div>
      </div>
    </div>
  );
}
