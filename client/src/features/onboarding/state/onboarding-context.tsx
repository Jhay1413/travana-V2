import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode, type RefObject } from "react";
import { browserStorage, clearDraft, loadDraft, saveDraft } from "./onboarding-draft";
import { reducer, startState, toDraft, type WizardState } from "./onboarding-state";
import type { OnboardingState, Step } from "../types";

interface OnboardingContextValue {
  state: WizardState;
  /** Saved server state (branches, owner, commission). Kept fresh by the query. */
  server: OnboardingState;
  userId: string;
  /** Attached to the current screen's heading; focused when the step changes. */
  headingRef: RefObject<HTMLHeadingElement | null>;
  patch: (patch: Partial<WizardState>) => void;
  goto: (step: Step) => void;
  /** Forget the local draft once onboarding is finished. */
  discardDraft: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface ProviderProps {
  userId: string;
  server: OnboardingState;
  children: ReactNode;
}

export function OnboardingProvider({ userId, server, children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    startState(loadDraft(browserStorage(), userId), server),
  );

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    saveDraft(browserStorage(), userId, toDraft(state));
  }, [state, userId]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      server,
      userId,
      headingRef,
      patch: (patch) => dispatch({ type: "patch", patch }),
      goto: (step) => dispatch({ type: "patch", patch: { step, review: null } }),
      discardDraft: () => clearDraft(browserStorage(), userId),
    }),
    [state, server, userId],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
