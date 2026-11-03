import type { ChecklistKey, OnboardingChecklist, OnboardingStatus } from "../types";

export interface ChecklistItemDef {
  key: ChecklistKey;
  title: string;
  /** Shown while the item is not done. */
  todo: string;
  /** Shown once it is done. */
  done: string;
  /** Button label; absent when there is nothing to do. */
  actionLabel?: string;
  /** V2 page the button opens. */
  href?: string;
}

export const CHECKLIST_ITEMS: readonly ChecklistItemDef[] = [
  { key: "account", title: "Create your account", todo: "Create your account.", done: "Done" },
  {
    key: "business",
    title: "Add your business details",
    todo: "Add your phone number and address.",
    done: "Done",
    actionLabel: "Add details",
    href: "/agency/profile",
  },
  {
    key: "invites",
    title: "Invite your team",
    todo: "Your agents can't log in until they're invited.",
    done: "Done",
    actionLabel: "Invite team",
    href: "/agency/team",
  },
  {
    key: "targets",
    title: "Set commission and monthly targets",
    todo: "Needed for the Target and Commission widgets.",
    done: "Done",
    actionLabel: "Set targets",
    href: "/agency/targets",
  },
  {
    key: "enquiry",
    title: "Add your first enquiry",
    todo: "Start building your pipeline.",
    done: "Done",
    actionLabel: "Add enquiry",
    href: "/pipeline",
  },
];

export interface ChecklistRow extends ChecklistItemDef {
  isDone: boolean;
}

export function checklistRows(checklist: OnboardingChecklist): ChecklistRow[] {
  return CHECKLIST_ITEMS.map((item) => ({ ...item, isDone: Boolean(checklist[item.key]) }));
}

export function checklistProgress(checklist: OnboardingChecklist): { done: number; total: number; percent: number } {
  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

export function isChecklistComplete(checklist: OnboardingChecklist): boolean {
  return CHECKLIST_ITEMS.every((i) => checklist[i.key]);
}

/** The dashboard card shows while onboarding is pending or any item is still open, unless dismissed. */
export function shouldShowChecklist(status: OnboardingStatus, checklist: OnboardingChecklist, dismissed: boolean): boolean {
  if (dismissed) return false;
  return status === "pending" || !isChecklistComplete(checklist);
}

/* ------------------------- per-user dismissal ----------------------------- */

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DISMISS_PREFIX = "travana.onboarding.checklist-dismissed.";

export const dismissKey = (userId: string): string => `${DISMISS_PREFIX}${userId}`;

export function loadDismissed(storage: StorageLike | null, userId: string): boolean {
  try {
    return storage?.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function saveDismissed(storage: StorageLike | null, userId: string, dismissed: boolean): void {
  try {
    if (dismissed) storage?.setItem(dismissKey(userId), "1");
    else storage?.removeItem(dismissKey(userId));
  } catch {
    // Storage unavailable: the card just comes back next visit.
  }
}
