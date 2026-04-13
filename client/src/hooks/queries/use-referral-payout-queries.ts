import { useQuery } from "@tanstack/react-query";
import { referralPayoutApi } from "@/api/endpoints/referral-payout.api";

export const referralPayoutKeys = {
  all: ["referral-payouts"] as const,
  lists: () => [...referralPayoutKeys.all, "list"] as const,
  detail: (id: string) => [...referralPayoutKeys.all, "detail", id] as const,
};

export function useReferralPayouts() {
  return useQuery({
    queryKey: referralPayoutKeys.lists(),
    queryFn: () => referralPayoutApi.getAll(),
  });
}

export function useReferralPayout(id: string) {
  return useQuery({
    queryKey: referralPayoutKeys.detail(id),
    queryFn: () => referralPayoutApi.getById(id),
    enabled: !!id,
  });
}
