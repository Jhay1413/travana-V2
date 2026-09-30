import { useQuery } from "@tanstack/react-query";
import { noteAttachmentApi } from "./note-attachment.api";
import type { NoteAttachment } from "../types";

export const noteAttachmentKeys = {
  all: ["note-attachments"] as const,
  byTransaction: (transactionId: string) => [...noteAttachmentKeys.all, "byTransaction", transactionId] as const,
};

/**
 * Every attachment on a deal's notes and replies, in one request. Callers
 * filter by `noteId`; all notes on the panel share this single cached query.
 */
export function useNoteAttachments(transactionId: string) {
  return useQuery<NoteAttachment[]>({
    queryKey: noteAttachmentKeys.byTransaction(transactionId),
    queryFn: () => noteAttachmentApi.getByTransaction(transactionId),
    enabled: !!transactionId,
  });
}
