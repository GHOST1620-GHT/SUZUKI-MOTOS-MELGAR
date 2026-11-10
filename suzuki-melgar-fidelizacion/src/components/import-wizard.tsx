"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import type { ImportRow } from "@/lib/importer";
import type { Category } from "@/lib/format";

const FIELDS: { key: keyof ImportRow; label: string; required?: boolean; hints: string[] }[] = [
  { key: "invoiceNumber", label: "N.º factura", required: true, hints: ["factura", "numero", "documento venta", "consecutivo", "prefijo", "no."] },
  { key: "date", label: "Fecha", hints: ["fecha", "date"] },
  { key: "document", label: "Cédula / NIT cliente", required: true, hints: ["nit", "cedula", "identificacion", "documento", "cc", "id cliente"] },
  { key: "name", label: "Nombre cliente", hints: ["nombre", "cliente", "razon social", "tercero"] },
  { key: "phone", label: "Celular", hints: ["celular", "telefono", "movil", "tel"] },
  { key: "email", label: "Correo", hints: ["correo", "email", "e-mail"] },
  { key: "amount", label: "Valor total", required: true, hints: ["total", "valor", "neto", "monto", "importe"] },
  { key: "category", label: "Categoría / línea", hints: ["categoria", "linea", "grupo", "tipo", "concepto", "centro"] },
  { key: "plate", label: "Placa", hints: ["placa"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

type Result = Awaited<ReturnType<typeof import("@/app/admin/import-actions").importMasControl>>;

export function ImportWizard({ action }: { action: (p: { fileName: string; rows: ImportRow[]; defaultCategory: Category }) => Promise<Result> }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [defCat, setDefCat] = useState<Category>("REPUESTOS");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);

  async function load(file: File) {
    setResult(null);
    setFileName(file.name);
    // CSV: se leen como texto para respetar el formato colombiano dd/mm/aaaa
    const isCsv = /\.(csv|txt)$/i.test(file.name);
    const wb = isCsv ? XLSX.read(await file.text(), { type: "string", raw: true }) : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
    const hs = rows.length ? Object.keys(rows[0]) : [];
    setHeaders(hs);
    setData(rows);
    const m: Record<string, string> = {};
    for (const f of FIELDS) {
      const h = hs.find((h) => f.hints.some((hint) => norm(h) === hint)) ?? hs.find((h) => f.hints.some((hint) => norm(h).includes(hint) && !Object.values(m).includes(h)));
      if (h) m[f.key] = h;
    }
    setMap(m);
  }

  const mapped: ImportRow[] = data.map((r) => {
    const o: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const v = map[f.key] ? r[map[f.key]] : "";
      o[f.key] = v instanceof Date ? v.toISOString() : v;
    }
    return o as ImportRow;
  });
  const missing = FIELDS.filter((f) => f.required && !map[f.key]);

  async function run() {
    setBusy(true);
    try {
      setResult(await action({ fileName, rows: mapped, defaultCategory: defCat }));
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <div>
            <p className="text-lg font-bold text-slate-900">Importación terminada</p>
            <p className="text-sm text-slate-500">{fileName}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          {[["Filas", result.total], ["Importadas", result.imported], ["Ya existían", result.skipped], ["Clientes nuevos", result.newCustomers], ["Puntos otorgados", result.points.toLocaleString("es-CO")]].map(([l, v]) => (
            <div key={String(l)} className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold">{v}</p></div>
          ))}
        </div>
        {result.errors.length > 0 && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">{result.errors.length} filas con error:</p>
            <ul className="mt-2 max-h-48 list-inside list-disc overflow-auto text-xs">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <button className="btn btn-primary mt-5" onClick={() => { setResult(null); setData([]); setHeaders([]); setFileName(""); }}>Importar otro archivo</button>
      </div>
    );

  return (
    <div className="space-y-6">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
        className={`card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400"}`}
      >
        {fileName ? <FileSpreadsheet className="size-10 text-emerald-600" /> : <Upload className="size-10 text-slate-400" />}
        <p className="mt-3 font-semibold text-slate-800">{fileName || "Arrastre aquí el archivo exportado de MasControl"}</p>
        <p className="mt-1 text-sm text-slate-500">{fileName ? `${data.length} filas leídas · clic para cambiar` : "Excel (.xlsx, .xls) o CSV · o haga clic para seleccionar"}</p>
        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </label>

      {headers.length > 0 && (
        <>
          <div className="card p-5">
            <p className="font-semibold text-slate-900">Relacione las columnas del archivo</p>
            <p className="text-sm text-slate-500">Las detectamos automáticamente; revise que sean correctas.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                  <select className={`input ${f.required && !map[f.key] ? "border-red-300" : ""}`} value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                    <option value="">— No incluir —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
              <label className="block">
                <span className="label">Categoría por defecto</span>
                <select className="input" value={defCat} onChange={(e) => setDefCat(e.target.value as Category)}>
                  <option value="MOTO">Moto</option><option value="REPUESTOS">Repuestos</option><option value="ACCESORIOS">Accesorios</option><option value="TALLER">Taller</option>
                </select>
                <span className="hint">Cuando la fila no indique la categoría.</span>
              </label>
            </div>
          </div>

          <div className="card overflow-hidden">
            <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">Vista previa (primeras 8 filas)</p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr>{FIELDS.filter((f) => map[f.key]).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>
                  {mapped.slice(0, 8).map((r, i) => (
                    <tr key={i}>{FIELDS.filter((f) => map[f.key]).map((f) => <td key={f.key} className="text-xs">{String(r[f.key] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {missing.length > 0 && <p className="text-sm text-red-600">Falta relacionar: {missing.map((m) => m.label).join(", ")}</p>}
            <button disabled={busy || missing.length > 0} onClick={run} className="btn btn-accent px-6">
              {busy ? <><Loader2 className="size-4 animate-spin" /> Importando {data.length} filas…</> : <>Importar {data.length} facturas y sumar puntos</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
