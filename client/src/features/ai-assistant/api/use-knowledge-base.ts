import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeBaseApi } from "./knowledge-base.api";
import type { KbEntryCreatePayload, KbEntryUpdatePayload } from "../types";

export const knowledgeBaseKeys = {
  all: ["knowledge-base"] as const,
  lists: () => [...knowledgeBaseKeys.all, "list"] as const,
};

export function useKnowledgeBase() {
  return useQuery({
    queryKey: knowledgeBaseKeys.lists(),
    queryFn: knowledgeBaseApi.getAll,
  });
}

export function useCreateKbEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KbEntryCreatePayload) => knowledgeBaseApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.lists() });
    },
  });
}

export function useUpdateKbEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: KbEntryUpdatePayload }) => knowledgeBaseApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.lists() });
    },
  });
}

export function useDeleteKbEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeBaseApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.lists() });
    },
  });
}
