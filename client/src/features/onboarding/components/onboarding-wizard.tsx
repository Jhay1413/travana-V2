import { useEffect, useRef } from "react";
import { useOnboarding } from "../state/onboarding-context";
import { AgentsStep } from "./agents-step";
import { BusinessStep } from "./business-step";
import { DoneStep } from "./done-step";
import { ReviewStep } from "./review-step";
import { ShopsStep } from "./shops-step";
import { TeamStep } from "./team-step";

/**
 * One screen per step:
 *   single shop: business -> agents (-> agents-review) -> done
 *   multi shop:  business -> shops (-> shops-review) -> team (-> team-review) -> done
 */
export function OnboardingWizard() {
  const { state, headingRef } = useOnboarding();
  const first = useRef(true);

  // Move focus to the new screen's heading so keyboard and screen-reader users land at the top.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [state.step, headingRef]);

  switch (state.step) {
    case "business":
      return <BusinessStep />;
    case "agents":
      return <AgentsStep />;
    case "shops":
      return <ShopsStep />;
    case "team":
      return <TeamStep />;
    case "agents-review":
    case "shops-review":
    case "team-review":
      return <ReviewStep />;
    case "done":
      return <DoneStep />;
  }
}
