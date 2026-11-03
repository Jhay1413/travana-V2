type KeyedStorage = Pick<Storage, "length" | "key" | "removeItem">;

/** Prefix of every saved onboarding wizard draft (one per user). */
export const ONBOARDING_DRAFT_PREFIX = "travana.onboarding.draft.v1.";

/** Remove every saved onboarding draft, e.g. on logout so the next person on this browser starts clean. */
export function clearAllOnboardingDrafts(storage: KeyedStorage | null): void {
  try {
    if (!storage) return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(ONBOARDING_DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
