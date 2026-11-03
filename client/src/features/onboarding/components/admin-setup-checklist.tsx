import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";
import { loadDismissed, saveDismissed, shouldShowChecklist, type ChecklistRow } from "../lib/checklist";
import { browserStorage } from "../state/onboarding-draft";
import { useOnboardingGate } from "../state/use-onboarding-gate";
import { SetupChecklistCard } from "./setup-checklist-card";

/** Small, dismissible setup card for the admin dashboard. Hidden once everything is done. */
export function AdminSetupChecklist() {
  const { state } = useOnboardingGate();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(() => loadDismissed(browserStorage(), userId));

  if (!state || !userId || !shouldShowChecklist(state.status, state.checklist, dismissed)) return null;

  const onAction = (item: ChecklistRow) => {
    if (state.status === "pending" && item.key === "invites") {
      navigate("/onboarding");
      return;
    }
    if (item.href) navigate(item.href);
  };

  return (
    <SetupChecklistCard
      compact
      checklist={state.checklist}
      onAction={onAction}
      onDismiss={() => {
        saveDismissed(browserStorage(), userId, true);
        setDismissed(true);
      }}
    />
  );
}
