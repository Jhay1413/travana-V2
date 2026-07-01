import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hubPostApi } from "./hub-post.api";

export const hubPostKeys = {
  all: ["hub-posts"] as const,
};

export function useHubPosts() {
  return useQuery({
    queryKey: hubPostKeys.all,
    queryFn: () => hubPostApi.getAll(),
    staleTime: 30_000,
  });
}

export function useCreateHubPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: string;
      content: string;
      image?: string | null;
      badge?: string | null;
    }) => hubPostApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: hubPostKeys.all }),
  });
}

export function useDeleteHubPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hubPostApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hubPostKeys.all }),
  });
}

export function useHideHubPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hubPostApi.hide(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hubPostKeys.all }),
  });
}

export function useToggleHubPostLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hubPostApi.toggleLike(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hubPostKeys.all }),
  });
}

export function useAddHubPostComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) =>
      hubPostApi.addComment(postId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: hubPostKeys.all }),
  });
}
