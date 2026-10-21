import { mapHeaders, type ImportField } from "./header-aliases";
import type { ImportRowInput } from "../types";

export const MAX_ROWS = 500;
export const MAX_BYTES = 2 * 1024 * 1024;

export const IMPORT_MESSAGES = {
  noNameColumn: 'That file has no "Tour Operator" column. Download the template to see the columns.',
  noRows: "That file has no tour operators in it.",
  tooManyRows: "That file has more than 500 rows. Split it into smaller files.",
  tooBig: "That file is over 2 MB. Split it into smaller files.",
  notCsv: "We can read .csv and .tsv files. In Excel, use Save As and pick CSV.",
  readFailed: "We couldn't read that file. Save it as CSV and try again.",
} as const;

/** Thrown with a message fit for the screen. */
export class ImportFileError extends Error {}

/** Size and type checks before the file is read. */
export function checkFile(file: { name: string; size: number }): void {
  if (file.size > MAX_BYTES) throw new ImportFileError(IMPORT_MESSAGES.tooBig);
  if (!/\.(csv|tsv|txt)$/i.test(file.name.trim())) throw new ImportFileError(IMPORT_MESSAGES.notCsv);
}

/** A parsed table (first row = headers) to import rows. Line numbers start at 2; blank rows are skipped. */
export function tableToImportRows(table: string[][]): ImportRowInput[] {
  const [header, ...body] = table;
  const cols = mapHeaders(header ?? []);
  if (cols.name === undefined) throw new ImportFileError(IMPORT_MESSAGES.noNameColumn);
  const rows: ImportRowInput[] = [];
  body.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) return;
    const value = (f: ImportField): string => {
      const idx = cols[f];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };
    rows.push({
      line: i + 2,
      name: value("name"),
      phone: value("phone"),
      website: value("website"),
      username: value("username"),
      password: value("password"),
      commission: value("commission"),
      balanceWeeks: value("balanceWeeks"),
    });
  });
  if (rows.length === 0) throw new ImportFileError(IMPORT_MESSAGES.noRows);
  if (rows.length > MAX_ROWS) throw new ImportFileError(IMPORT_MESSAGES.tooManyRows);
  return rows;
}

