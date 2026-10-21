export type ImportField = "name" | "phone" | "website" | "username" | "password" | "commission" | "balanceWeeks";

const ALIASES: Record<ImportField, string[]> = {
  name: ["tour operator", "operator", "name", "supplier"],
  phone: ["phone", "telephone"],
  website: ["weblink", "website", "web", "link", "url"],
  username: ["username", "user name", "login"],
  password: ["password"],
  commission: ["commission rate", "commission", "commission %", "rate"],
  balanceWeeks: ["balance due", "balance due (weeks)", "balance weeks", "balance"],
};

function norm(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Column index of each known field in a header row (first match wins). */
export function mapHeaders(header: string[]): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  const cells = header.map(norm);
  for (const field of Object.keys(ALIASES) as ImportField[]) {
    const idx = cells.findIndex((c) => ALIASES[field].includes(c));
    if (idx >= 0) out[field] = idx;
  }
  return out;
}
