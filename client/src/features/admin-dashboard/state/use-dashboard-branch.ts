import { useMemo, useState } from "react";
import { useBranches } from "@/hooks/queries";
import { ALL_BRANCHES, branchIdParam, resolveSelectedBranch } from "../lib/branch-selection";

const BRANCH_STORAGE_KEY = "admin-dashboard.branch";

function loadStoredBranch(): string {
  try {
    return localStorage.getItem(BRANCH_STORAGE_KEY) || ALL_BRANCHES;
  } catch {
    return ALL_BRANCHES;
  }
}

function saveStoredBranch(value: string): void {
  try {
    localStorage.setItem(BRANCH_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode / quota): the selection just won't persist.
  }
}

/** The page-level branch selector. It scopes every real widget on the dashboard. */
export function useDashboardBranch() {
  const { data: branches, isSuccess: branchesLoaded } = useBranches();
  const [stored, setStored] = useState<string>(loadStoredBranch);

  const sortedBranches = useMemo(
    () => [...(branches ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [branches],
  );
  const showSelect = sortedBranches.length > 1;
  const selected = resolveSelectedBranch({
    stored,
    branchesLoaded,
    showSelect,
    branchIds: sortedBranches.map((b) => b.id),
  });

  const setBranch = (value: string) => {
    setStored(value);
    saveStoredBranch(value);
  };

  return { sortedBranches, showSelect, selected, branchId: branchIdParam(selected), setBranch };
}
