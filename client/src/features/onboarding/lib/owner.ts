import type { RowResult } from "./validation";
import type { OnboardingOwner, PersonRow } from "../types";

export const OWN_EMAIL_MESSAGE = "That's your own email. You're already the owner.";

/** The locked "You · Owner/Admin" row at the top of the people table, or null when the owner is unknown. */
export function ownerLabel(owner: OnboardingOwner): { name: string; email: string } | null {
  const name = [owner.firstName, owner.lastName].filter((p): p is string => Boolean(p && p.trim())).join(" ");
  const email = owner.email ?? "";
  return name || email ? { name, email } : null;
}

/** Rows that use the owner's own email become errors: the owner is never invited. */
export function flagOwnerEmail<T>(
  rows: PersonRow[],
  results: RowResult<T>[],
  ownerEmail: string | null | undefined,
): RowResult<T>[] {
  const owner = ownerEmail?.trim().toLowerCase();
  if (!owner) return results;
  return results.map((result, i) => {
    const row = rows[i];
    if (!row || result.blank || row.email.trim().toLowerCase() !== owner) return result;
    return { ...result, errors: { ...result.errors, email: OWN_EMAIL_MESSAGE }, data: null };
  });
}
