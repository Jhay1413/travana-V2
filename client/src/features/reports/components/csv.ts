import Papa from "papaparse";

/**
 * Generates a CSV from row objects (keys become headers in the order of the first row),
 * then triggers a browser download.
 */
export function exportCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
