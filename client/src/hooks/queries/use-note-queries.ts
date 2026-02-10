import { useQuery } from "@tanstack/react-query";
import { noteApi } from "@/api/endpoints/note.api";
import type { TransactionNote } from "@/types/quote";

export const noteKeys = {
  all: ["notes"] as const,
  byTransaction: (transactionId: string) => [...noteKeys.all, "byTransaction", transactionId] as const,
};

export function useNotes(transactionId: string) {
  return useQuery<TransactionNote[]>({
    queryKey: noteKeys.byTransaction(transactionId),
    queryFn: () => noteApi.getByTransaction(transactionId),
    enabled: !!transactionId,
  });
}
