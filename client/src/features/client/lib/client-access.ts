// Who may change what on the client page. social_media_manager is read-only:
// every write action (edit, add deal/task/note, PIN, files, referrer, badge)
// is hidden for that primary role. Homeworkers keep their existing tab limits.

export function isClientReadOnly(orgRole: string | null | undefined): boolean {
  return orgRole === "social_media_manager";
}
