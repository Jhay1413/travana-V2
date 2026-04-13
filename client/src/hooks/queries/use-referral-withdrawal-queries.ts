import { useQuery } from "@tanstack/react-query";
import { referralWithdrawalApi } from "@/api/endpoints/referral-withdrawal.api";

export const referralWithdrawalKeys = {
  all: ["referral-withdrawals"] as const,
  lists: () => [...referralWithdrawalKeys.all, "list"] as const,
  detail: (id: string) => [...referralWithdrawalKeys.all, "detail", id] as const,
};

export function useReferralWithdrawals() {
  return useQuery({
    queryKey: referralWithdrawalKeys.lists(),
    queryFn: () => referralWithdrawalApi.getAll(),
  });
}

export function useReferralWithdrawal(id: string) {
  return useQuery({
    queryKey: referralWithdrawalKeys.detail(id),
    queryFn: () => referralWithdrawalApi.getById(id),
    enabled: !!id,
  });
}
