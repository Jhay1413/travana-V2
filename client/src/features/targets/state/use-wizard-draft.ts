import { useCallback, useEffect, useState } from "react";
import { browserStorage, clearDraft, draftKey, loadDraft, saveDraft, type WizardDraft } from "../lib/draft";
import type { Plan } from "../types";

/**
 * The "Save and finish later" draft for one organisation, person and year, kept in localStorage.
 * With no signed-in person yet there is no key, so nothing is read or written.
 */
export function useWizardDraft(orgId: string | null, userId: string | null, year: number) {
  const key = orgId && userId ? draftKey(orgId, userId, year) : null;
  const [draft, setDraft] = useState<WizardDraft | null>(() => (key ? loadDraft(browserStorage(), key) : null));

  // A different year (or person) has its own draft.
  useEffect(() => {
    setDraft(key ? loadDraft(browserStorage(), key) : null);
  }, [key]);

  const save = useCallback(
    (plan: Plan, snapshot: Plan, step: number): boolean => {
      if (!key) return false;
      const ok = saveDraft(browserStorage(), key, { plan, snapshot, step });
      if (ok) setDraft(loadDraft(browserStorage(), key));
      return ok;
    },
    [key],
  );

  const discard = useCallback(() => {
    if (key) clearDraft(browserStorage(), key);
    setDraft(null);
  }, [key]);

  return { draft, save, discard };
}
