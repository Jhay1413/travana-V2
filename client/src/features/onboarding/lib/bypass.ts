type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const BYPASS_PREFIX = "travana.onboarding.bypass.v1.";

/** Session-only, per user: "Continue to dashboard anyway" survives navigation but not a new tab/session. */
export function setOnboardingBypass(storage: StorageLike, userId: string): void {
  if (!userId) return;
  try {
    storage.setItem(`${BYPASS_PREFIX}${userId}`, "1");
  } catch {
    /* storage unavailable: the bypass just won't stick */
  }
}

export function hasOnboardingBypass(storage: StorageLike, userId: string): boolean {
  if (!userId) return false;
  try {
    return storage.getItem(`${BYPASS_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

let leaving = false;

/** True while the done step is navigating away, so the wizard page does not redirect over the chosen target. */
export function setOnboardingLeaving(value: boolean): void {
  leaving = value;
}
export function isOnboardingLeaving(): boolean {
  return leaving;
}
