import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { useMenuMode } from "@/components/layout/menu-mode-context";
import { requestErrorMessage } from "@/lib/request-error";
import { onboardingKeys } from "../api/use-onboarding-queries";
import { setOnboardingBypass, setOnboardingLeaving } from "../lib/bypass";
import { setOnboardingComplete, useCompleteOnboarding } from "../api/use-onboarding-mutations";
import type { ChecklistRow } from "../lib/checklist";
import { useOnboarding } from "../state/onboarding-context";
import { ERROR_TEXT, MUTED_LINK_BUTTON, PRIMARY_BUTTON } from "./styles";
import { SetupChecklistCard } from "./setup-checklist-card";
import { StepLayout } from "./step-layout";

const DASHBOARD_PATH = "/agency/overview";

/** Last screen: invite summary, the setup checklist and "Go to dashboard". */
export function DoneStep() {
  const { state, server, goto, discardDraft } = useOnboarding();
  const complete = useCompleteOnboarding();
  const qc = useQueryClient();
  const { setMode } = useMenuMode();
  const [, navigate] = useLocation();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const multi = state.business.businessType === "multi";
  const invited = state.sentEmails.length;

  function leave(to: string) {
    setOnboardingLeaving(true);
    discardDraft();
    setMode("admin");
    // Cache says complete first (so the gate lets the target through), then navigate, then
    // refetch; the leaving flag stops the page redirecting over the chosen target.
    setOnboardingComplete(qc);
    navigate(to);
    void qc.invalidateQueries({ queryKey: onboardingKeys.state() });
  }

  /** Finishing failed: let the admin into the app for this session without touching draft or cache. */
  function leaveAnyway() {
    setOnboardingBypass(window.sessionStorage, userId);
    setMode("admin");
    navigate(DASHBOARD_PATH);
  }

  async function finish(to: string = DASHBOARD_PATH) {
    setError(null);
    try {
      await complete.mutateAsync();
    } catch (e) {
      setError(requestErrorMessage(e, "We couldn't finish setting up. Try again."));
      return;
    }
    leave(to);
  }

  function onAction(item: ChecklistRow) {
    if (item.key === "invites") {
      goto(multi ? "team" : "agents");
      return;
    }
    void finish(item.href ?? DASHBOARD_PATH);
  }

  return (
    <StepLayout
      wide
      title="You're all set"
      subtitle={
        invited > 0
          ? `${invited} ${invited === 1 ? "invite" : "invites"} sent. Each person gets an email to set their password.`
          : "Your account is ready. Finish the steps below whenever you like."
      }
    >
      <SetupChecklistCard
        checklist={server.checklist}
        onAction={onAction}
        describe={(item) =>
          item.key === "invites" && invited === 0
            ? "You skipped this. Your agents can't log in until they're invited."
            : undefined
        }
      />
      {error && (
        <div role="alert" className="mt-3 flex items-center justify-end gap-4">
          <span className={`${ERROR_TEXT} text-[13px]`}>{error}</span>
          {/* Never a dead end: the dashboard is reachable even if finishing keeps failing. */}
          <button type="button" className={MUTED_LINK_BUTTON} onClick={leaveAnyway}>
            Continue to dashboard anyway
          </button>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Button type="button" className={PRIMARY_BUTTON} disabled={complete.isPending} onClick={() => void finish()}>
          {complete.isPending ? "Finishing…" : <>Go to dashboard &rarr;</>}
        </Button>
      </div>
    </StepLayout>
  );
}
