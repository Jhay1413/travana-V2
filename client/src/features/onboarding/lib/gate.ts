export const ONBOARDING_PATH = "/onboarding";

/** Routes a pending org admin may still open: the wizard itself and auth / public screens. */
const ALLOWED_PREFIXES = [
  ONBOARDING_PATH,
  "/logout",
  "/api/",
  "/verify-email",
  "/accept-invite",
  "/signup",
  "/signup-agency",
  "/forgot-password",
  "/reset-password",
  "/portal",
  "/travana",
  "/view-quote",
  "/cruise-quote-preview",
];

export interface OnboardingGateInput {
  isOrgAdmin: boolean;
  isPending: boolean;
  isError: boolean;
  /** The admin chose "Continue to dashboard anyway" this session. */
  bypassed?: boolean;
}

export function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`));
}

/**
 * Where a pending org admin must be sent from `path`, or null to leave them alone.
 * Fails open: a failed or unfinished status lookup never redirects.
 */
export function onboardingRedirectFor(path: string, gate: OnboardingGateInput): string | null {
  if (!gate.isOrgAdmin || !gate.isPending || gate.isError || gate.bypassed) return null;
  return isAllowed(path) ? null : ONBOARDING_PATH;
}

const MAX_STATE_RETRIES = 2;

/** Retry the /state lookup twice, only for server (5xx) or network failures. */
export function shouldRetryOnboardingState(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_STATE_RETRIES) return false;
  const status =
    typeof error === "object" && error !== null
      ? ((error as { status?: unknown }).status ?? (error as { response?: { status?: unknown } }).response?.status)
      : undefined;
  return typeof status !== "number" || status >= 500;
}

/** True when the app should show a loader instead of a page that might be redirected away. */
export function shouldHoldForOnboarding(path: string, isLoading: boolean): boolean {
  return isLoading && !isAllowed(path);
}

/** A lookup only counts as failed when there is nothing to show (stale data keeps the app open). */
export function isStateLoadFailure(q: { isError: boolean; data: unknown }): boolean {
  return q.isError && !q.data;
}
