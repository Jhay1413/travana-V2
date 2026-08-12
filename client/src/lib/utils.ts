import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Legacy CRM import artifact: `client.title` holds the literal string "NULL"
// for many records (empty spreadsheet cells imported as text), so a plain
// filter(Boolean) keeps it and renders "NULL Adam Howe". The server filters
// the same sentinel in its own name builders — this is the client-side twin.
export function clientDisplayName(client: {
  title?: string | null;
  firstName?: string | null;
  surename?: string | null;
}): string {
  return [client.title, client.firstName, client.surename]
    .filter((part): part is string => !!part && part !== "NULL" && part !== "—")
    .join(" ")
    .trim();
}
