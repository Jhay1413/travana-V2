// Who sees a delete button on an attachment. Mirrors the server rule: the reply
// author for reply files, the ticket raiser for ticket-level files, and
// branch managers / org admins / platform admins on anything they can see.

export const ATTACHMENT_ADMIN_ROLES = ["branch_manager", "org_admin", "platform_admin"] as const;

export function canDeleteAttachment({
  userId,
  isAdmin,
  ticketUserId,
  replyAuthorId,
}: {
  userId: string | undefined;
  isAdmin: boolean;
  ticketUserId: string;
  /** The author of the reply the file was posted with; null for a ticket-level file. */
  replyAuthorId: string | null;
}): boolean {
  if (!userId) return false;
  if (isAdmin) return true;
  return replyAuthorId !== null ? replyAuthorId === userId : ticketUserId === userId;
}
