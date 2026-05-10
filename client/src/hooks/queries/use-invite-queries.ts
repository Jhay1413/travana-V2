import { useQuery } from "@tanstack/react-query";
import { inviteApi, type InviteInfo, type PendingInvite } from "@/api/endpoints/invite.api";

export const inviteKeys = {
  all: ["invites"] as const,
  pending: () => [...inviteKeys.all, "pending"] as const,
  byToken: (token: string) => [...inviteKeys.all, "byToken", token] as const,
};

export function usePendingInvites(options?: { enabled?: boolean }) {
  return useQuery<PendingInvite[]>({
    queryKey: inviteKeys.pending(),
    queryFn: inviteApi.list,
    enabled: options?.enabled ?? true,
  });
}

export function useInviteByToken(token: string | null | undefined) {
  return useQuery<InviteInfo>({
    queryKey: inviteKeys.byToken(token ?? ""),
    queryFn: () => inviteApi.getByToken(token as string),
    enabled: !!token,
    retry: false,
  });
}
