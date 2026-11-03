// Public surface of the onboarding feature.
export { OnboardingPage } from "./components/onboarding-page";
export { AdminSetupChecklist } from "./components/admin-setup-checklist";
export { SignupForm } from "./components/signup-form";
export { useOnboardingGate } from "./state/use-onboarding-gate";
export { canRunOnboarding } from "./lib/access";
export { onboardingRedirectFor, shouldHoldForOnboarding } from "./lib/gate";
