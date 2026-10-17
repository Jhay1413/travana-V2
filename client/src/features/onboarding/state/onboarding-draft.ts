import { ONBOARDING_DRAFT_PREFIX } from "@/lib/onboarding-drafts";
import { STEPS, type WizardDraft } from "./onboarding-state";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;


/** One draft per signed-in user, so two people on a shared browser never see each other's answers. */
export const draftKey = (userId: string): string => `${ONBOARDING_DRAFT_PREFIX}${userId}`;

function isDraft(value: unknown): value is WizardDraft {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Partial<WizardDraft>;
  return (
    d.version === 1 &&
    typeof d.step === "string" &&
    (STEPS as readonly string[]).includes(d.step) &&
    typeof d.business === "object" &&
    d.business !== null &&
    Array.isArray(d.agents) &&
    Array.isArray(d.shops) &&
    Array.isArray(d.team) &&
    typeof d.commission === "string"
  );
}

export function loadDraft(storage: StorageLike | null, userId: string): WizardDraft | null {
  try {
    const raw = storage?.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    // Private mode, bad JSON or blocked storage: start fresh.
    return null;
  }
}

export function saveDraft(storage: StorageLike | null, userId: string, draft: WizardDraft): void {
  try {
    storage?.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // Storage unavailable: the wizard still works, it just won't remember.
  }
}

export function clearDraft(storage: StorageLike | null, userId: string): void {
  try {
    storage?.removeItem(draftKey(userId));
  } catch {
    // ignore
  }
}

/** window.localStorage, or null where it can't be touched (SSR, blocked storage). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
