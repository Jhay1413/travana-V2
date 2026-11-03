import { isCsvFile, parseCsvText } from "@/lib/csv";
import { MAX_ROWS, tableToInviteRows, type BranchOption, type InviteRow } from "./invite-rows";

export class SheetError extends Error {}

const READ_FAILED = "We couldn't read that file. Save it as .csv and try again.";

/** CSV text to invite rows. Throws a SheetError with a message fit for the screen. */
export function csvTextToInviteRows(text: string, branches: BranchOption[]): InviteRow[] {
  const table = parseCsvText(text);
  if (table.length === 0) throw new SheetError("We couldn't find any people in that file.");
  const rows = tableToInviteRows(table, branches);
  if (rows.length === 0) throw new SheetError("We couldn't find any people in that file.");
  if (rows.length > MAX_ROWS) throw new SheetError(`That is more than ${MAX_ROWS} people. Split the list into smaller files.`);
  return rows;
}

/** Read a CSV file picked by the user. Excel files are not supported (no spreadsheet parser is installed). */
export async function readInviteFile(file: File, branches: BranchOption[]): Promise<InviteRow[]> {
  if (!isCsvFile(file.name)) {
    throw new SheetError("Upload a .csv file. In Excel, use Save As and pick CSV.");
  }
  try {
    return csvTextToInviteRows(await file.text(), branches);
  } catch (err) {
    throw err instanceof SheetError ? err : new SheetError(READ_FAILED);
  }
}

export { isCsvFile, parseCsvText };
