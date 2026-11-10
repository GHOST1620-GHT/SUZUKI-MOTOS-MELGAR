/**
 * Webhook para recibir facturas desde MasControl (o un integrador) en tiempo real.
 * Autenticación: encabezado x-api-key = MASCONTROL_API_KEY
 */
import { NextResponse } from "next/server";
import { importRows, type ImportRow } from "@/lib/importer";

type Incoming = Record<string, unknown>;

function toRow(b: Incoming): ImportRow {
  const g = (...k: string[]) => k.map((x) => b[x]).find((v) => v !== undefined && v !== null && v !== "");
  return {
    invoiceNumber: String(g("factura", "invoiceNumber", "numero") ?? ""),
    date: (g("fecha", "date") as string) ?? null,
    document: String(g("cedula", "nit", "document", "documento") ?? ""),
    name: (g("nombre", "name", "cliente") as string) ?? null,
    phone: (g("celular", "telefono", "phone") as string) ?? null,
    email: (g("correo", "email") as string) ?? null,
    amount: (g("total", "valor", "amount") as number) ?? 0,
    category: (g("categoria", "linea", "category") as string) ?? null,
    plate: (g("placa", "plate") as string) ?? null,
  };
}

export async function POST(req: Request) {
  const key = req.headers.get("x-api-key");
  if (!process.env.MASCONTROL_API_KEY || key !== process.env.MASCONTROL_API_KEY) {
    return NextResponse.json({ ok: false, error: "API key inválida" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const list = (Array.isArray(body) ? body : [body]) as Incoming[];
  const result = await importRows(list.map(toRow), { defaultCategory: "REPUESTOS", source: "API" });
  return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status: result.imported || result.skipped ? 200 : 422 });
}
