import type { InviteResult } from "../types";

export const MANAGER_NOTE = "Already invited as shop manager";
export const INVITED_NOTE = "Invited";

export const normEmail = (email: string): string => email.trim().toLowerCase();

/** Union of two email lists, lower-cased, without duplicates. */
export function addEmails(existing: string[], added: string[]): string[] {
  return Array.from(new Set([...existing, ...added].map(normEmail).filter(Boolean)));
}

/** Where an email stands: already sent from a table, already invited as a shop manager, or neither. */
export function inviteStanding(email: string, sent: string[], managers: string[]): "sent" | "manager" | null {
  const e = normEmail(email);
  if (sent.includes(e)) return "sent";
  if (managers.includes(e)) return "manager";
  return null;
}

/** Rows that still need an invite: not sent before and not already invited as a shop manager. */
export function stillToInvite<T extends { email: string }>(rows: T[], sent: string[], managers: string[]): T[] {
  return rows.filter((r) => inviteStanding(r.email, sent, managers) === null);
}

/** Per-row results for the table: persisted standing wins, otherwise this session's live result. */
export function displayResults(
  rows: { id: string; email: string }[],
  live: Record<string, InviteResult>,
  sent: string[],
  managers: string[],
): Record<string, InviteResult> {
  const out: Record<string, InviteResult> = {};
  for (const row of rows) {
    const standing = inviteStanding(row.email, sent, managers);
    if (standing === "sent") out[row.id] = { status: "sent", message: INVITED_NOTE };
    else if (standing === "manager") out[row.id] = { status: "sent", message: MANAGER_NOTE };
    else {
      const result = live[row.id];
      if (result) out[row.id] = result;
    }
  }
  return out;
}
