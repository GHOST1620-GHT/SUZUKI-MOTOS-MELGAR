/**
 * Logo del concesionario (archivos en /public):
 *  - logo.png        → fondos claros
 *  - logo-white.png  → fondos oscuros
 *  - logo-mark.png   → solo el símbolo (espacios pequeños)
 * Para cambiar el logo basta con reemplazar esos archivos.
 */
export function Brand({ dark = false, compact = false, size = "md", label = true }: { dark?: boolean; compact?: boolean; size?: "md" | "lg"; label?: boolean }) {
  if (compact) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/logo-mark.png" alt="Suzuki Melgar Moto" className="h-8 w-auto" />;
  }
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark ? "/logo-white.png" : "/logo.png"} alt="Suzuki Melgar Moto" className={size === "lg" ? "h-20 w-auto sm:h-24" : "h-11 w-auto"} />
      {label && size === "md" && (
        <span className={`border-l pl-3 text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] ${dark ? "border-white/25 text-brand-100" : "border-slate-200 text-slate-500"}`}>
          Club de
          <br />
          fidelización
        </span>
      )}
    </div>
  );
}
