import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementApi } from "./announcement.api";

export const announcementKeys = {
  all: ["announcements"] as const,
  list: (category?: string) => ["announcements", category ?? "all"] as const,
  likes: ["announcement-likes"] as const,
  hidden: ["announcement-hidden"] as const,
};

export function useAnnouncements(category?: string) {
  return useQuery({
    queryKey: announcementKeys.list(category),
    queryFn: () => announcementApi.getAll(category ? { category } : undefined),
    staleTime: 30_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; content: string; category: string; pinned?: boolean; postToAll?: boolean; imageUrl?: string }) =>
      announcementApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; content?: string; category?: string; pinned?: boolean; postToAll?: boolean; imageUrl?: string }) =>
      announcementApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useToggleAnnouncementPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.togglePin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useBulkLikes() {
  return useQuery({
    queryKey: announcementKeys.likes,
    queryFn: () => announcementApi.getBulkLikes(),
    staleTime: 15_000,
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.toggleLike(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.likes });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useHiddenAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.hidden,
    queryFn: () => announcementApi.getHidden(),
    staleTime: 30_000,
  });
}

export function useHideAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.hide(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.hidden }),
  });
}

export function useSharePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.sharePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
