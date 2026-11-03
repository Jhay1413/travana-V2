export const ALL_BRANCHES = "all";

/**
 * Only trust a stored branch id once the branch list confirms it exists in this org, and only when
 * the page offers a branch select at all. A deleted or foreign id would otherwise 404 the page.
 */
export function resolveSelectedBranch(input: {
  stored: string;
  branchesLoaded: boolean;
  showSelect: boolean;
  branchIds: string[];
}): string {
  const { stored, branchesLoaded, showSelect, branchIds } = input;
  if (stored === ALL_BRANCHES || !branchesLoaded || !showSelect) return ALL_BRANCHES;
  return branchIds.includes(stored) ? stored : ALL_BRANCHES;
}

export function branchIdParam(selected: string): string | undefined {
  return selected === ALL_BRANCHES ? undefined : selected;
}
