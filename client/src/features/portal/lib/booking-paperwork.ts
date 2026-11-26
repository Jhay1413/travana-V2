import type { PortalDocument } from "@shared/portal-documents";
import type { PortalPassenger } from "@shared/portal-passengers";
import { toRoman } from "./quote-format";

/** "240 KB", "1.4 MB": decimal units, one decimal only when it helps. "" when the size is not known. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  const mb = bytes / 1_000_000;
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** The small line under a document's name: "PDF · Tickets · 240 KB", leaving out what is not known. */
export function documentDetail(doc: Pick<PortalDocument, "kind" | "category" | "sizeBytes">): string {
  return [doc.kind, doc.category ?? "", formatFileSize(doc.sizeBytes)].map((part) => part.trim()).filter(Boolean).join(" · ");
}

/** The closing note under the documents list (the design's, with "documents" since we hold more than vouchers). */
export const DOCUMENTS_NOTE = "We'll let you know as soon as your tickets and documents are ready.";

export interface ChecklistRow {
  key: "passports" | "documents";
  numeral: string;
  label: string;
  note: string;
  done: boolean;
  status: "✓ Done" | "To do";
}

/**
 * The design's "Before you go" list, with only the rows that have real data behind them. Passport details are done when
 * every listed traveller has a passport; travel documents when at least one document is listed. A row whose data is
 * not known (`null`: still loading or failed) is left out rather than guessed. Numbered in Roman numerals in order shown.
 */
export function buildChecklist(passengers: ReadonlyArray<Pick<PortalPassenger, "hasPassport">> | null, documentCount: number | null): ChecklistRow[] {
  const rows: Array<Omit<ChecklistRow, "numeral" | "status">> = [];
  if (passengers && passengers.length > 0) {
    const added = passengers.filter((p) => p.hasPassport).length;
    const done = added === passengers.length;
    rows.push({
      key: "passports",
      label: "Passport details",
      note: done ? "We have them for everyone" : `${added} of ${passengers.length} added. Add the rest above`,
      done,
    });
  }
  if (documentCount !== null) {
    rows.push({
      key: "documents",
      label: "Travel documents",
      note: documentCount > 0 ? "Ready to download above" : "We'll let you know when they are ready",
      done: documentCount > 0,
    });
  }
  return rows.map((row, i) => ({ ...row, numeral: toRoman(i + 1), status: row.done ? "✓ Done" : "To do" }));
}
