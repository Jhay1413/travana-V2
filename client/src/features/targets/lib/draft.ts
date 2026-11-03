import { TARGETS_DRAFT_PREFIX } from "@/lib/targets-drafts";
import type { Plan } from "../types";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A half-finished allocation kept by "Save and finish later". */
export interface WizardDraft {
  version: 2;
  step: number;
  plan: Plan;
  /** The saved numbers the person started from; only boxes that differ from it count as their changes. */
  snapshot: Plan;
  savedAt: string;
}

/** One draft per organisation, person and year, so shared browsers never mix them up. */
export const draftKey = (orgId: string, userId: string, year: number): string =>
  `${TARGETS_DRAFT_PREFIX}${orgId}.${userId}.${year}`;

const isPlan = (p: unknown): p is Plan => {
  const plan = p as Partial<Plan> | undefined;
  return typeof plan === 'object' && plan !== null && typeof plan.business === 'string' && isStringRecord(plan.shops) && isStringRecord(plan.agents);
};

const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string");

function isDraft(value: unknown): value is WizardDraft {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Partial<WizardDraft>;
  return d.version === 2 && typeof d.step === "number" && typeof d.savedAt === "string" && isPlan(d.plan) && isPlan(d.snapshot);
}

export function loadDraft(storage: StorageLike | null, key: string): WizardDraft | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    // Private mode, bad JSON or blocked storage: act as if there is no draft.
    return null;
  }
}

/** Returns false when the browser would not store it, so the page can say so instead of lying. */
export function saveDraft(storage: StorageLike | null, key: string, draft: Omit<WizardDraft, "version" | "savedAt">, now: Date = new Date()): boolean {
  if (!storage) return false;
  try {
    const value: WizardDraft = { version: 2, savedAt: now.toISOString(), ...draft };
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: StorageLike | null, key: string): void {
  try {
    storage?.removeItem(key);
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
