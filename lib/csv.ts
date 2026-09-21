export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const str = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeRow = (row: (string | number | null | undefined)[]) =>
    row.map((cell) => toCsvCell(cell)).join(",");
  return [escapeRow(headers), ...rows.map(escapeRow)].join("\r\n");
}

/** Force a CSV download from a server action by returning a Response with the right headers. */
export function csvResponse(filename: string, csv: string): Response {
  const body = "﻿" + csv; // BOM for Excel UTF-8
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
