import { useQuery } from "@tanstack/react-query";
import { onboardingApi } from "./onboarding.api";
import { shouldRetryOnboardingState } from "../lib/gate";
import type { OnboardingState } from "../types";

export const onboardingKeys = {
  all: ["onboarding"] as const,
  state: () => [...onboardingKeys.all, "state"] as const,
};

/**
 * Onboarding state. Only org admins may call it (everyone else gets a 403), so callers pass
 * `enabled` from the role check.
 */
export function useOnboardingState(options: { enabled: boolean }) {
  return useQuery<OnboardingState>({
    queryKey: onboardingKeys.state(),
    queryFn: onboardingApi.getState,
    enabled: options.enabled,
    staleTime: 30_000,
    retry: shouldRetryOnboardingState,
  });
}
