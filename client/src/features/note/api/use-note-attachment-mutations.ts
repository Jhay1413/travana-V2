import { useMutation, useQueryClient } from "@tanstack/react-query";
import { noteApi, type CreateNoteData } from "./note.api";
import { noteAttachmentApi } from "./note-attachment.api";
import { noteKeys } from "./use-note-queries";
import { noteAttachmentKeys } from "./use-note-attachment-queries";
import type { TransactionNote } from "@/features/quote/types";

export function useDeleteNoteAttachment(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noteAttachmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteAttachmentKeys.byTransaction(transactionId) });
    },
  });
}

export interface CreateNoteWithAttachmentsResult {
  note: TransactionNote;
  /** True when the note was saved but its files could not be uploaded. */
  uploadFailed: boolean;
}

/**
 * Creates a note (or reply, via `parent_id`) and then uploads the files the
 * user picked in the composer. The note id does not exist until the note is
 * created, so files are held client-side and uploaded right after. A failed
 * upload does NOT fail the mutation — the note already exists — it is
 * reported through `uploadFailed` so the caller can toast it.
 */
export function useCreateNoteWithAttachments(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation<CreateNoteWithAttachmentsResult, Error, { data: CreateNoteData; files?: File[] }>({
    mutationFn: async ({ data, files }) => {
      const note = await noteApi.create(data);
      let uploadFailed = false;
      if (files && files.length > 0) {
        try {
          await noteAttachmentApi.upload(note.id, files);
        } catch {
          uploadFailed = true;
        }
      }
      return { note, uploadFailed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.byTransaction(transactionId) });
      queryClient.invalidateQueries({ queryKey: noteAttachmentKeys.byTransaction(transactionId) });
    },
  });
}
