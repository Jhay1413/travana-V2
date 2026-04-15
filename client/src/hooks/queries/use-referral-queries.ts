import { useQuery } from "@tanstack/react-query";
import { referralApi } from "@/api/endpoints/referral.api";

export const referralKeys = {
  all: ["referrals"] as const,
  lists: () => [...referralKeys.all, "list"] as const,
  detail: (id: string) => [...referralKeys.all, "detail", id] as const,
  byClient: (clientId: string) => [...referralKeys.all, "client", clientId] as const,
  statsByClient: (clientId: string) => [...referralKeys.all, "client", clientId, "stats"] as const,
  vipOverview: (clientId: string) => [...referralKeys.all, "client", clientId, "vip-overview"] as const,
};

export function useReferrals() {
  return useQuery({
    queryKey: referralKeys.lists(),
    queryFn: () => referralApi.getAll(),
  });
}

export function useReferral(id: string) {
  return useQuery({
    queryKey: referralKeys.detail(id),
    queryFn: () => referralApi.getById(id),
    enabled: !!id,
  });
}

export function useReferralsByClient(clientId: string) {
  return useQuery({
    queryKey: referralKeys.byClient(clientId),
    queryFn: () => referralApi.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function useReferralStatsByClient(clientId: string) {
  return useQuery({
    queryKey: referralKeys.statsByClient(clientId),
    queryFn: () => referralApi.getStatsByClient(clientId),
    enabled: !!clientId,
  });
}

export function useVipOverview(clientId: string) {
  return useQuery({
    queryKey: referralKeys.vipOverview(clientId),
    queryFn: () => referralApi.getVipOverview(clientId),
    enabled: !!clientId,
  });
}
