import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementApi } from "@/api/endpoints/announcement.api";

export const announcementKeys = {
  all: ["announcements"] as const,
};

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.all,
    queryFn: () => announcementApi.getAll(),
    staleTime: 30_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; content: string; category: string; pinned?: boolean }) =>
      announcementApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; content?: string; category?: string; pinned?: boolean }) =>
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
