import { desc } from "drizzle-orm";
import { Download, Plug } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { ImportWizard } from "@/components/import-wizard";
import { Card, PageHeader } from "@/components/ui";
import { importMasControl } from "../../import-actions";

export const metadata = { title: "Importar MasControl" };

export default async function Importar() {
  await requireStaff(["ADMIN", "ASESOR"]);
  const batches = await db.query.importBatches.findMany({ orderBy: desc(S.importBatches.createdAt), limit: 10, with: { createdBy: true } });

  return (
    <>
      <PageHeader
        title="Importar ventas de MasControl"
        subtitle="Exporte desde MasControl el informe de ventas/facturas a Excel y súbalo aquí. Las facturas ya registradas se omiten automáticamente."
        actions={<a href="/plantilla-mascontrol.csv" download className="btn btn-secondary"><Download className="size-4" /> Descargar plantilla</a>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ImportWizard action={importMasControl} />
        </div>
        <div className="space-y-6">
          <Card title="Paso a paso">
            <ol className="list-inside list-decimal space-y-2 text-sm text-slate-600">
              <li>En MasControl abra el informe de <b>ventas por factura</b> del período.</li>
              <li>Exporte a <b>Excel</b> (debe incluir n.º de factura, cédula/NIT, nombre, valor total y fecha).</li>
              <li>Arrastre el archivo arriba y verifique las columnas.</li>
              <li>Pulse <b>Importar</b>: se suman los puntos y se crean los clientes nuevos con su bono de bienvenida.</li>
            </ol>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Recomendación: importe a diario o semanalmente. Si la columna de categoría trae palabras como “moto”, “repuesto”, “accesorio” o “taller/servicio”, se clasifica sola.</p>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Plug className="size-4" /> Integración automática (API)</span>}>
            <p className="text-sm text-slate-600">Si el proveedor de MasControl puede enviar cada factura al momento de emitirla, use este endpoint:</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{`POST /api/integraciones/mascontrol
x-api-key: <MASCONTROL_API_KEY>
Content-Type: application/json

{
  "factura": "FV-10234",
  "fecha": "2026-11-10",
  "cedula": "1234567890",
  "nombre": "Andrés Rodríguez",
  "celular": "3001234567",
  "total": 350000,
  "categoria": "Repuestos",
  "placa": "ABC12D"
}`}</pre>
            <p className="mt-2 text-xs text-slate-500">También acepta un arreglo de facturas. La clave se configura en el archivo <code>.env</code>.</p>
          </Card>
          <Card title="Historial de importaciones" padded={false}>
            <ul className="divide-y divide-slate-100">
              {batches.map((b) => (
                <li key={b.id} className="px-5 py-3 text-sm">
                  <p className="truncate font-medium text-slate-800">{b.fileName}</p>
                  <p className="text-xs text-slate-500">{dateTime(b.createdAt)} · {b.createdBy?.name}</p>
                  <p className="mt-1 text-xs"><span className="text-emerald-600">{b.imported} importadas</span> · <span className="text-slate-500">{b.skipped} omitidas</span> · <span className="text-brand-700">{b.newCustomers} clientes nuevos</span></p>
                </li>
              ))}
              {batches.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Sin importaciones todavía.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
