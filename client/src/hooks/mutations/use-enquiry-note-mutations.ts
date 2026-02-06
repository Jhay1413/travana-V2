import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enquiryNoteApi, type CreateEnquiryNoteData } from "@/api/endpoints/enquiry-note.api";
import { enquiryNoteKeys } from "@/hooks/queries/use-enquiry-note-queries";

export function useCreateEnquiryNote(enquiryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEnquiryNoteData) => enquiryNoteApi.create(enquiryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryNoteKeys.byEnquiry(enquiryId) });
    },
  });
}

export function useUpdateEnquiryNote(enquiryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      enquiryNoteApi.update(enquiryId, id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryNoteKeys.byEnquiry(enquiryId) });
    },
  });
}

export function useDeleteEnquiryNote(enquiryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enquiryNoteApi.delete(enquiryId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryNoteKeys.byEnquiry(enquiryId) });
    },
  });
}
