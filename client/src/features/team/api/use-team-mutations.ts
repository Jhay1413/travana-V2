import { useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationKeys } from "@/features/organization/api/use-organization-queries";
import { userKeys } from "@/hooks/queries";
import { teamApi } from "./team.api";
import type { MemberProfilePatch, RemoveMemberInput } from "../types";

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: RemoveMemberInput & { userId: string }) => teamApi.removeMember(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      // Deals, tasks, tickets and clients just changed hands.
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["neon-clients"] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useUpdateMemberProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...patch }: MemberProfilePatch & { userId: string }) =>
      teamApi.updateMemberProfile(userId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
