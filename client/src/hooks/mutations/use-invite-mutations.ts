import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inviteApi, type AcceptInvitePayload, type SendInvitePayload } from "@/api/endpoints/invite.api";
import { inviteKeys } from "@/hooks/queries/use-invite-queries";
import { organizationKeys } from "@/hooks/queries/use-organization-queries";

export function useSendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendInvitePayload) => inviteApi.send(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inviteKeys.pending() });
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
    },
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => inviteApi.resend(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: inviteKeys.pending() }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => inviteApi.revoke(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inviteKeys.pending() });
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
    },
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (payload: AcceptInvitePayload) => inviteApi.accept(payload),
  });
}
