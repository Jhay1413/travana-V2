import { useMutation, useQueryClient } from "@tanstack/react-query";
import { homeworkersApi } from "./homeworkers.api";
import { invalidateHomeworkerData } from "./invalidate";
import { organizationKeys } from "@/features/organization/api/use-organization-queries";
import { inviteKeys } from "@/features/invite/api/use-invite-queries";
import type { InviteHomeworkerPayload, UpdateHomeworkerPayload } from "../types";

export function useInviteHomeworker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteHomeworkerPayload) => homeworkersApi.invite(payload),
    onSuccess: () => {
      invalidateHomeworkerData(qc);
      qc.invalidateQueries({ queryKey: inviteKeys.pending() });
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
    },
  });
}

export function useUpdateHomeworker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, payload }: { branchId: string; payload: UpdateHomeworkerPayload }) =>
      homeworkersApi.update(branchId, payload),
    onSuccess: () => invalidateHomeworkerData(qc),
  });
}

export function useArchiveHomeworker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) => homeworkersApi.archive(branchId),
    onSuccess: () => {
      invalidateHomeworkerData(qc);
      qc.invalidateQueries({ queryKey: organizationKeys.members() });
    },
  });
}
