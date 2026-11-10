"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

type Hit = { id: string; name: string; document: string; phone: string; points: number; level: string | null; color: string | null; plates: string };

/** Buscador de clientes con autocompletado (cédula, nombre, celular o placa). */
export function CustomerPicker({ basePath, param = "cliente", autoFocus = true }: { basePath: string; param?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q)}`);
      setHits(r.ok ? await r.json() : []);
      setIdx(0);
      setLoading(false);
    }, 200);
  }, [q]);

  const choose = (h: Hit) => router.push(`${basePath}${basePath.includes("?") ? "&" : "?"}${param}=${h.id}`);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, hits.length - 1));
          if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
          if (e.key === "Enter" && hits[idx]) {
            e.preventDefault();
            choose(hits[idx]);
          }
        }}
        className="input py-3.5 pl-12 text-base"
        placeholder="Escriba cédula, nombre, celular o placa del cliente…"
      />
      {loading && <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-slate-400" />}
      {hits.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => choose(h)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === idx ? "bg-brand-50" : ""}`}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: h.color ?? "#0f2f9c" }}>
                  {h.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">{h.name}</span>
                  <span className="block truncate text-xs text-slate-500">CC {h.document} · {h.phone}{h.plates ? ` · ${h.plates}` : ""}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold text-slate-800">{h.points.toLocaleString("es-CO")} pts</span>
                  <span className="block text-xs text-slate-500">{h.level}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !loading && hits.length === 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-xl">
          No se encontró el cliente. <a href="/admin/clientes/nuevo" className="font-semibold text-brand-700 hover:underline">Registrarlo ahora →</a>
        </div>
      )}
    </div>
  );
}
