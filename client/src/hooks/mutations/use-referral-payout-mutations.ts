import { useMutation, useQueryClient } from "@tanstack/react-query";
import { referralPayoutApi } from "@/api/endpoints/referral-payout.api";
import { referralPayoutKeys } from "@/hooks/queries/use-referral-payout-queries";
import { referralKeys } from "@/hooks/queries/use-referral-queries";

export function useApproveReferralPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      referralPayoutApi.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralPayoutKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useRejectReferralPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      referralPayoutApi.reject(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralPayoutKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}
