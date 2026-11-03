import { isCsvFile, parseCsvText } from "@/lib/csv";
import { HOMEWORKER_SHOP, ROLE_LABELS, isHomeworkerText, parseRole } from "./roles";
import { uid } from "./rows";
import type { ShopChoice } from "./schemas";
import type { PersonRow, ShopRow } from "../types";

export type Table = string[][];

export class SheetError extends Error {}

export const MAX_SHEET_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Aliases<K extends string> = Record<K, string[]>;

const PERSON_ALIASES: Aliases<"firstName" | "lastName" | "email" | "shop" | "role"> = {
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "last", "surname", "familyname"],
  email: ["email", "emailaddress", "workemail"],
  shop: ["shop", "shopname", "branch", "office", "location"],
  role: ["role", "jobrole", "position", "jobtitle", "title"],
};

const SHOP_ALIASES: Aliases<"name" | "address" | "email" | "phone" | "managerEmail"> = {
  name: ["shopname", "name", "shop", "branch"],
  address: ["address", "shopaddress"],
  email: ["shopemail", "email", "emailaddress"],
  phone: ["phone", "phonenumber", "telephone", "tel", "mobile"],
  managerEmail: ["manageremail", "managersemail", "manageremailaddress", "branchmanageremail"],
};

/**
 * Find which column holds which field. If the first row looks like headers we match by
 * name; otherwise we fall back to the column order shown in the template.
 */
function mapColumns<K extends string>(
  table: Table,
  aliases: Aliases<K>,
  positional: K[],
): { index: Record<K, number>; body: Table } {
  const header = (table[0] ?? []).map(norm);
  const index = {} as Record<K, number>;
  let hits = 0;
  for (const key of Object.keys(aliases) as K[]) {
    const found = header.findIndex((h) => aliases[key].includes(h));
    index[key] = found;
    if (found >= 0) hits += 1;
  }
  if (hits >= 2) return { index, body: table.slice(1) };
  positional.forEach((key, i) => {
    index[key] = i;
  });
  return { index, body: table };
}

const pick = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

export interface PeopleOptions {
  /** Team step: read a Shop column and match it to the created shops. */
  withShop: boolean;
  shops: ShopChoice[];
}

/** Match a typed shop name to a branch id; "Homeworker" gives the sentinel; anything else stays as typed. */
export function matchShop(raw: string, shops: ShopChoice[]): string {
  const n = norm(raw);
  if (!n) return "";
  if (n === HOMEWORKER_SHOP) return HOMEWORKER_SHOP;
  return shops.find((s) => norm(s.name) === n)?.id ?? raw.trim();
}

export function tableToPeople(table: Table, opts: PeopleOptions): PersonRow[] {
  const positional = opts.withShop
    ? (["firstName", "lastName", "email", "shop", "role"] as const)
    : (["firstName", "lastName", "email", "role"] as const);
  const { index, body } = mapColumns(table, PERSON_ALIASES, [...positional]);
  return body.map((row) => {
    const roleRaw = pick(row, index.role);
    const role = parseRole(roleRaw);
    let shop = opts.withShop
      ? matchShop(pick(row, index.shop), opts.shops)
      : isHomeworkerText(pick(row, index.shop))
        ? HOMEWORKER_SHOP
        : "";
    // A "Homeworker" role with no shop means the person is a homeworker.
    if (opts.withShop && !shop && isHomeworkerText(roleRaw)) shop = HOMEWORKER_SHOP;
    return {
      id: uid(),
      firstName: pick(row, index.firstName),
      lastName: pick(row, index.lastName),
      email: pick(row, index.email),
      shop,
      role: role ? ROLE_LABELS[role] : roleRaw,
    };
  });
}

export function tableToShops(table: Table): ShopRow[] {
  const { index, body } = mapColumns(table, SHOP_ALIASES, ["name", "address", "email", "phone", "managerEmail"]);
  return body.map((row) => ({
    id: uid(),
    name: pick(row, index.name),
    address: pick(row, index.address),
    email: pick(row, index.email),
    phone: pick(row, index.phone),
    managerEmail: pick(row, index.managerEmail),
  }));
}

/** Pasted text (tab-separated, straight from Excel or Google Sheets) to rows of cells. */
export function parsePasted(text: string): Table {
  return parseCsvText(text.replace(/\r?\n$/, "")).filter((r) => r.some((c) => c !== ""));
}

/** CSV text to a table, with the same limits as a file upload. Throws a SheetError. */
export function csvToTable(text: string): Table {
  const table = parseCsvText(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length === 0) throw new SheetError("We couldn't find any rows in that file.");
  if (table.length > MAX_SHEET_ROWS) {
    throw new SheetError(`That file has more than ${MAX_SHEET_ROWS} rows. Split it into smaller files.`);
  }
  return table;
}

/** Read a CSV file picked by the user. Excel files are not supported (no spreadsheet parser is installed). */
export async function readSheetFile(file: File): Promise<Table> {
  if (file.size > MAX_BYTES) throw new SheetError("That file is over 2 MB. Split it into smaller files.");
  if (!isCsvFile(file.name)) {
    throw new SheetError("Upload a .csv file. In Excel, use Save As and pick CSV.");
  }
  try {
    return csvToTable(await file.text());
  } catch (err) {
    throw err instanceof SheetError ? err : new SheetError("We couldn't read that file. Save it as .csv and try again.");
  }
}
