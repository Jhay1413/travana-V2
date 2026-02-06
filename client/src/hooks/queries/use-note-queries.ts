import { useQuery } from "@tanstack/react-query";
import { noteApi } from "@/api/endpoints/note.api";
import type { Note } from "@shared/schema";

export const noteKeys = {
  all: ["notes"] as const,
  byQuote: (quoteId: string) => [...noteKeys.all, "byQuote", quoteId] as const,
};

export function useNotes(quoteId: string) {
  return useQuery<Note[]>({
    queryKey: noteKeys.byQuote(quoteId),
    queryFn: () => noteApi.getByQuote(quoteId),
    enabled: !!quoteId,
  });
}
