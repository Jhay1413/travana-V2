import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { requestErrorMessage } from "@/lib/request-error";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingState } from "../api/use-onboarding-queries";
import { isOnboardingLeaving, setOnboardingLeaving } from "../lib/bypass";
import { isStateLoadFailure } from "../lib/gate";
import { OnboardingProvider } from "../state/onboarding-context";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingWizard } from "./onboarding-wizard";
import { OUTLINE_BUTTON } from "./styles";

/** Route component for /onboarding (org admins only; the router enforces the role). */
export function OnboardingPage() {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const query = useOnboardingState({ enabled: true });
  const [, navigate] = useLocation();
  const { logout } = useAuth();

  // The done step sets this while it navigates away; clear it once the page is gone.
  useEffect(() => () => setOnboardingLeaving(false), []);

  if (query.isLoading || !userId) {
    return (
      <OnboardingShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-social-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </div>
      </OnboardingShell>
    );
  }

  if (isStateLoadFailure(query) || !query.data) {
    return (
      <OnboardingShell>
        <div className="mx-auto mt-24 max-w-md text-center">
          <h1 className="text-[20px] font-semibold">We couldn't load your setup</h1>
          <p role="alert" className="text-social-muted">
            {requestErrorMessage(query.error, "Please try again in a moment.")}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={OUTLINE_BUTTON}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />}
              Try again
            </Button>
            <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => navigate("/agency/overview")}>
              Continue to dashboard
            </Button>
            <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  // Finished businesses never see the wizard.
  if (query.data.status === "complete") {
    // Leaving via a checklist link: the done step has already navigated, do not override it.
    return isOnboardingLeaving() ? null : <Redirect to="/agency/overview" />;
  }

  return (
    <OnboardingShell>
      <OnboardingProvider userId={userId} server={query.data}>
        <OnboardingWizard />
      </OnboardingProvider>
    </OnboardingShell>
  );
}
