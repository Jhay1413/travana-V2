/** One first-name source: the linked client's first name, falling back to the chat contact. */
export function firstNameFor(
  client: { firstName?: string | null } | null | undefined,
  contact: { firstName?: string | null; displayName: string },
): string {
  return client?.firstName?.trim() || contact.firstName?.trim() || contact.displayName.trim().split(" ")[0] || "them";
}
