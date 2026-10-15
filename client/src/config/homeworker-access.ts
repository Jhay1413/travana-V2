import type { OrgRole } from "@/types/auth/auth.types";

/** Staff roles allowed into inbox / social routes: everyone on staff except homeworkers (server denies them). */
export const INBOX_SOCIAL_ROLES: OrgRole[] = ["platform_admin", "org_admin", "branch_manager", "agent"];

/** Drops tabs the server denies to homeworkers (inbox, chats). Returns the list unchanged otherwise. */
export function omitHomeworkerDeniedTabs<T extends { value: string }>(
  tabs: readonly T[],
  isHomeworker: boolean,
  deniedValues: readonly string[],
): T[] {
  return isHomeworker ? tabs.filter((t) => !deniedValues.includes(t.value)) : [...tabs];
}
