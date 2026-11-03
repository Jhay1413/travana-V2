import { useQuery } from "@tanstack/react-query";
import { noteAttachmentApi } from "./note-attachment.api";
import { noteKeys } from "./use-note-queries";
import type { NoteAttachment } from "../types";

export const noteAttachmentKeys = {
  all: ["note-attachments"] as const,
  byTransaction: (transactionId: string) => [...noteAttachmentKeys.all, "byTransaction", transactionId] as const,
  /** Nested under `noteKeys.byClient` so any client-note invalidation refreshes it too. */
  byClient: (clientId: string, includeDeals: boolean) =>
    [...noteKeys.byClient(clientId), "attachments", { includeDeals }] as const,
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

/** Attachments on a client's notes (and, with `includeDeals`, notes on its deals) in one request. */
export function useClientNoteAttachments(clientId: string, includeDeals: boolean) {
  return useQuery<NoteAttachment[]>({
    queryKey: noteAttachmentKeys.byClient(clientId, includeDeals),
    queryFn: () => noteAttachmentApi.listByClient(clientId, includeDeals),
    enabled: !!clientId,
  });
}
