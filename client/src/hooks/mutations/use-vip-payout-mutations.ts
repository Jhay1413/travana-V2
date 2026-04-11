import { useMutation, useQueryClient } from "@tanstack/react-query";
import { vipPayoutApi, type CreateVipPayoutData } from "@/api/endpoints/vip-payout.api";
import { vipPayoutKeys } from "@/hooks/queries/use-vip-payout-queries";
import { referralKeys } from "@/hooks/queries/use-referral-queries";

export function useCreateVipPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVipPayoutData) => vipPayoutApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vipPayoutKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useProcessVipPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      vipPayoutApi.process(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vipPayoutKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}
