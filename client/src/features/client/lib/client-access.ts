// Who may change what on the client page. social_media_manager is read-only:
// every write action (edit, add deal/task/note, PIN, files, referrer, badge)
// is hidden for that primary role. Homeworkers keep their existing tab limits.

/** Only org admins and platform admins may delete a client (server enforces the same list). */
export function canDeleteClient(orgRole: string | null | undefined): boolean {
  return orgRole === "org_admin" || orgRole === "platform_admin";
}

export function isClientReadOnly(orgRole: string | null | undefined): boolean {
  return orgRole === "social_media_manager";
}
