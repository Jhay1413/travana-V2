import { useMutation, useQueryClient } from "@tanstack/react-query";
import { noteApi, type CreateNoteData } from "@/api/endpoints/note.api";
import { noteKeys } from "@/hooks/queries/use-note-queries";

export function useCreateNote(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteData) => noteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byQuote(quoteId) });
    },
  });
}

export function useUpdateNote(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      noteApi.update(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byQuote(quoteId) });
    },
  });
}

export function useDeleteNote(quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noteApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byQuote(quoteId) });
    },
  });
}
