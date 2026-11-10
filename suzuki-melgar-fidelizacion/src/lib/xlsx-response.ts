import * as XLSX from "xlsx";

export function xlsxResponse(rows: Record<string, unknown>[], sheet: string, fileName: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
