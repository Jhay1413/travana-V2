import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  commentsApi,
  type ListCommentsQuery,
  type PrivateReplyInput,
  type SsCommentTriageState,
} from "./comments.api";

export const commentsKeys = {
  all: ["comments"] as const,
  list: (query: ListCommentsQuery) => [...commentsKeys.all, "list", query] as const,
  detail: (id: string) => [...commentsKeys.all, "detail", id] as const,
  capabilities: () => [...commentsKeys.all, "capabilities"] as const,
};

export function useComments(query: ListCommentsQuery = {}, enabled = true) {
  return useQuery({
    queryKey: commentsKeys.list(query),
    queryFn: () => commentsApi.list(query),
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useComment(id: string | null, enabled = true) {
  return useQuery({
    queryKey: commentsKeys.detail(id ?? ""),
    queryFn: () => commentsApi.getById(id as string),
    enabled: !!id && enabled,
  });
}

/**
 * Which of the org's channels can do comments at all. Used to decide whether
 * to show the Comments tab: an org with no Instagram/Facebook channel — or
 * without the Beta feature switched on — should not see an empty queue with
 * no explanation.
 *
 * `retry: false` because the informative failure here is a 403
 * `feature_not_enabled`, which will never succeed on a retry.
 */
export function useCommentCapabilities(enabled = true) {
  return useQuery({
    queryKey: commentsKeys.capabilities(),
    queryFn: () => commentsApi.capabilities(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

function useInvalidateComments() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: commentsKeys.all });
    if (id) qc.invalidateQueries({ queryKey: commentsKeys.detail(id) });
  };
}

export function useTriageComment() {
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: SsCommentTriageState }) => commentsApi.triage(id, state),
    onSuccess: (_result, { id }) => invalidate(id),
  });
}

/**
 * Sends the one private reply Meta allows for a comment.
 *
 * No optimistic update and no retry, deliberately: the attempt is unrepeatable,
 * so the UI must show the true server outcome rather than a hopeful one. The
 * server re-checks eligibility against fresh state before spending it.
 */
export function usePrivateReply() {
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PrivateReplyInput }) => commentsApi.privateReply(id, input),
    retry: false,
    onSuccess: (_result, { id }) => invalidate(id),
  });
}
