/**
 * Default "Assigned to": the conversation's assignee (matched by display name,
 * as the inbox carries names not ids), else the current user. "" until known.
 */
export function defaultAssigneeId(
  users: { id: string; name?: string | null; email: string }[],
  conversationAssignee: string | null | undefined,
  currentUserId: string | undefined,
): string {
  const assigned = conversationAssignee ? users.find((u) => (u.name || u.email) === conversationAssignee) : undefined;
  return assigned?.id ?? currentUserId ?? "";
}
