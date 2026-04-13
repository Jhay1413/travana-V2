import { useMutation, useQueryClient } from "@tanstack/react-query";
import { referralWithdrawalApi, type ProcessWithdrawalData } from "@/api/endpoints/referral-withdrawal.api";
import { referralWithdrawalKeys } from "@/hooks/queries/use-referral-withdrawal-queries";
import { referralKeys } from "@/hooks/queries/use-referral-queries";

export function useProcessReferralWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessWithdrawalData }) =>
      referralWithdrawalApi.process(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useRejectReferralWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      referralWithdrawalApi.reject(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralWithdrawalKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}
