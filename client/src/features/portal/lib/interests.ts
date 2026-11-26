/** Pure rules for the travel-interests screen. */

/** The set with the id added, or removed when it was already in it (the original is not changed). */
export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Saving needs at least one interest, and no save already in flight. */
export function canSaveInterests(count: number, saving: boolean): boolean {
  return count > 0 && !saving;
}

/** The line above the save button. */
export function selectionText(count: number): string {
  return count === 0 ? "Select at least one interest to continue" : `${count} selected`;
}
