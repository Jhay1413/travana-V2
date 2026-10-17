import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { branchKeys, organizationKeys } from "@/features/organization";
import { isNotPendingError, shopResultsNotPending } from "../lib/not-pending";
import { onboardingApi } from "./onboarding.api";
import { onboardingKeys } from "./use-onboarding-queries";
import type { OnboardingState, SaveBusinessInput, ShopInput, SignupInput } from "../types";

/** Flip the cached status to complete so the wizard page redirects to the dashboard. */
/** Flip the cached status to complete (no refetch). */
export function setOnboardingComplete(qc: QueryClient): void {
  qc.setQueryData<OnboardingState>(onboardingKeys.state(), (old) => (old ? { ...old, status: "complete" } : old));
}

/** Flip the cached status to complete so the wizard page redirects to the dashboard. */
export function markOnboardingComplete(qc: QueryClient): void {
  setOnboardingComplete(qc);
  qc.invalidateQueries({ queryKey: onboardingKeys.state() });
}

export function useSignup() {
  return useMutation({ mutationFn: (input: SignupInput) => onboardingApi.signup(input) });
}

export function useSaveBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveBusinessInput) => onboardingApi.saveBusiness(input),
    onSuccess: (state: OnboardingState) => {
      qc.setQueryData(onboardingKeys.state(), state);
      qc.invalidateQueries({ queryKey: organizationKeys.all });
    },
    // Already complete elsewhere (another tab, another admin): leave the wizard.
    onError: (error) => {
      if (isNotPendingError(error)) markOnboardingComplete(qc);
    },
  });
}

export function useCreateShops() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shops: ShopInput[]) => onboardingApi.createShops(shops),
    onSuccess: ({ results }) => {
      if (shopResultsNotPending(results)) markOnboardingComplete(qc);
    },
    onError: (error) => {
      if (isNotPendingError(error)) markOnboardingComplete(qc);
    },
    // Created shops (and their ids) come back through the state query.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: onboardingKeys.state() });
      qc.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}

export function useSaveHomeworkerCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (percent: number | null) => onboardingApi.saveHomeworkerCommission(percent),
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
    onError: (error) => {
      if (isNotPendingError(error)) markOnboardingComplete(qc);
    },
  });
}

/**
 * POST /complete. A 409 "not pending" means it is already done, which is what we wanted, so it
 * counts as success. The cache is NOT flipped here: the caller navigates first, then calls
 * markOnboardingComplete, so the page's own redirect can't override the chosen destination.
 */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (): Promise<{ status: "complete" }> => {
      try {
        return await onboardingApi.complete();
      } catch (error) {
        if (isNotPendingError(error)) return { status: "complete" };
        throw error;
      }
    },
  });
}
