"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import type { Category } from "@/lib/format";
import { importRows, type ImportRow } from "@/lib/importer";

export async function importMasControl(payload: { fileName: string; rows: ImportRow[]; defaultCategory: Category }) {
  const user = await requireStaff(["ADMIN", "ASESOR"]);
  const r = await importRows(payload.rows.slice(0, 5000), { defaultCategory: payload.defaultCategory, createdById: user.id, source: "IMPORTACION" });
  await db.insert(S.importBatches).values({
    fileName: payload.fileName,
    totalRows: r.total,
    imported: r.imported,
    skipped: r.skipped,
    newCustomers: r.newCustomers,
    log: r.errors.slice(0, 200).join("\n"),
    createdById: user.id,
  });
  revalidatePath("/admin", "layout");
  return r;
}
