/**
 * Which tabs the Activity card shows. Pure, so the visibility rules
 * (homeworkers, no client, read-only roles) are unit tested.
 */
import { omitHomeworkerDeniedTabs } from "@/config/homeworker-access";

export type ActivityTab = "messages" | "notes" | "tasks" | "tickets";

export interface ActivityTabDef {
  value: ActivityTab;
  label: string;
}

const ALL_TABS: ActivityTabDef[] = [
  { value: "messages", label: "Messages" },
  { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" },
  { value: "tickets", label: "Tickets" },
];

export interface ActivityTabsInput {
  isHomeworker: boolean;
  hasClient: boolean;
  readOnly: boolean;
}

/**
 * - Messages: hidden for homeworkers (the server denies them the inbox) and
 *   when there is no client to talk to.
 * - Tickets: hidden for read-only roles (it holds a reply composer) and with
 *   no client.
 */
export function activityTabs({ isHomeworker, hasClient, readOnly }: ActivityTabsInput): ActivityTabDef[] {
  return omitHomeworkerDeniedTabs(ALL_TABS, isHomeworker, ["messages"]).filter(
    (t) => !(!hasClient && (t.value === "messages" || t.value === "tickets")) && !(readOnly && t.value === "tickets"),
  );
}

/** Messages when it is shown, otherwise Notes. */
export function defaultActivityTab(tabs: readonly ActivityTabDef[]): ActivityTab {
  return tabs.some((t) => t.value === "messages") ? "messages" : "notes";
}
