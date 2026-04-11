import { useQuery } from "@tanstack/react-query";
import { vipPayoutApi } from "@/api/endpoints/vip-payout.api";

export const vipPayoutKeys = {
  all: ["vip-payouts"] as const,
  lists: () => [...vipPayoutKeys.all, "list"] as const,
  detail: (id: string) => [...vipPayoutKeys.all, "detail", id] as const,
};

export function useVipPayouts() {
  return useQuery({
    queryKey: vipPayoutKeys.lists(),
    queryFn: () => vipPayoutApi.getAll(),
  });
}

export function useVipPayout(id: string) {
  return useQuery({
    queryKey: vipPayoutKeys.detail(id),
    queryFn: () => vipPayoutApi.getById(id),
    enabled: !!id,
  });
}
