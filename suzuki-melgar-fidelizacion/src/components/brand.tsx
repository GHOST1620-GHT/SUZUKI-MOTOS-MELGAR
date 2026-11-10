import { Bike } from "lucide-react";

/** Marca del concesionario. Para usar el logo oficial, ponga /public/logo.png y reemplace el ícono. */
export function Brand({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-md ring-1 ring-white/20">
        <Bike className="size-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={`block text-base font-extrabold tracking-tight ${dark ? "text-white" : "text-brand-800"}`}>
            SUZUKI <span className={dark ? "text-red-400" : "text-accent-500"}>MELGAR</span>
          </span>
          <span className={`block text-[10px] font-medium uppercase tracking-[0.12em] whitespace-nowrap ${dark ? "text-brand-200" : "text-slate-500"}`}>Club de fidelización</span>
        </span>
      )}
    </div>
  );
}
