export type ListTab = "open" | "snoozed" | "done";

export interface EmptyCopyInput {
  tab: ListTab;
  hasSearch: boolean;
  hasFilters: boolean;
}

/** Empty-state copy for the conversation list. */
export function emptyCopy({ tab, hasSearch, hasFilters }: EmptyCopyInput): string {
  if (hasSearch || hasFilters) return "Nothing matches. Try clearing the search or filters.";
  if (tab === "open") return "Everything is answered. Nice work.";
  if (tab === "snoozed") return "Nothing is snoozed.";
  return "Nothing has been marked done yet.";
}
