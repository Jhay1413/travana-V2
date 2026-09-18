import { useMutation, useQueryClient } from "@tanstack/react-query";
import { noteApi, type CreateNoteData } from "./note.api";
import { noteKeys } from "./use-note-queries";

export function useCreateNote(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteData) => noteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(transactionId) });
    },
  });
}

export function useUpdateNote(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      noteApi.update(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(transactionId) });
    },
  });
}

export function useDeleteNote(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noteApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(transactionId) });
    },
  });
}

export function useCreateClientNote(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateNoteData, "client_id">) =>
      noteApi.create({ ...data, client_id: clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byClient(clientId) });
    },
  });
}

export function useUpdateClientNote(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // `transactionId` is optional and only used to also refresh that deal's
    // own notes panel when this note belongs to one of the client's deals.
    mutationFn: ({ id, content }: { id: string; content: string; transactionId?: string | null }) =>
      noteApi.update(id, content),
    onSuccess: (_note, variables) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byClient(clientId) });
      if (variables.transactionId) {
        queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(variables.transactionId) });
      }
    },
  });
}

export function useDeleteClientNote(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; transactionId?: string | null }) => noteApi.delete(id),
    onSuccess: (_void, variables) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byClient(clientId) });
      if (variables.transactionId) {
        queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(variables.transactionId) });
      }
    },
  });
}
