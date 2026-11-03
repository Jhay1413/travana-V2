import type { OnboardingBranch } from "../types";

/** Branches the admin can see and pick: everything except the unclaimed signup placeholder. */
export function visibleBranches(branches: OnboardingBranch[]): OnboardingBranch[] {
  return branches.filter((b) => !b.isPlaceholder);
}

/** The branch single-shop invites join: the default branch, else the first one. */
export function defaultBranch(branches: OnboardingBranch[]): OnboardingBranch | undefined {
  return branches.find((b) => b.isDefault) ?? branches[0];
}
