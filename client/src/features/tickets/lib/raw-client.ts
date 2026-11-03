// The v2 `/api/v2/clients/:id` endpoint (useClient) returns the raw client_table
// row, not the flattened `Client` shape the rest of the client feature is typed
// against. Read the real columns and cast around the stale type.
export interface RawClientRow {
  title?: string | null;
  firstName?: string | null;
  surename?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  createdAt?: string | null;
}

/** "Mar 2024" for a member-since line; null when the date is missing or invalid. */
export function memberSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Phone numbers come back as the string "NULL" when missing. */
export function cleanContact(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.toUpperCase() !== "NULL" ? trimmed : null;
}

/** A client the new-ticket dialog has selected. */
export interface PickedClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}
