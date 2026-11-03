import type { PillTone } from "@/components/shared/status-pill";
import type { ImportPlanRow, ImportPreview, ImportResult, ImportStatus } from "../types";

export const STATUS_LABEL: Record<ImportStatus, string> = { new: "New", update: "Update", same: "No change", error: "Error" };
export const STATUS_TONE: Record<ImportStatus, PillTone> = { new: "info", update: "warn", same: "plain", error: "bad" };

export function countOf(rows: ImportPlanRow[], status: ImportStatus): number {
  return rows.filter((r) => r.status === status).length;
}

/** "{file}: 2 new, 1 to update, 3 unchanged[, 1 with errors (these are skipped)]." */
export function previewSubtitle(file: string, preview: ImportPreview): string {
  const added = countOf(preview.rows, "new");
  const updated = countOf(preview.rows, "update");
  const same = countOf(preview.rows, "same");
  const errors = countOf(preview.rows, "error");
  const tail = errors > 0 ? `, ${errors} with errors (these are skipped)` : "";
  return `${file}: ${added} new, ${updated} to update, ${same} unchanged${tail}.`;
}

export function importableCount(rows: ImportPlanRow[]): number {
  return countOf(rows, "new") + countOf(rows, "update");
}

export function importButtonLabel(n: number): string {
  return `Import ${n} ${n === 1 ? "operator" : "operators"}`;
}

export function importToast(result: Pick<ImportResult, "added" | "updated">): string {
  return `Imported: ${result.added} added, ${result.updated} updated`;
}

export function previewCommission(value: ImportPlanRow["commission"]): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : String(value);
}
