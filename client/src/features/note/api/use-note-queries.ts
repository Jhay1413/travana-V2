import { useQuery } from "@tanstack/react-query";
import { noteApi } from "./note.api";
import type { TransactionNote } from "@/features/quote/types";

export const noteKeys = {
  all: ["notes"] as const,
  byTransaction: (transactionId: string) => [...noteKeys.all, "byTransaction", transactionId] as const,
  byClient: (clientId: string) => [...noteKeys.all, "byClient", clientId] as const,
};

export function useNotes(transactionId: string) {
  return useQuery<TransactionNote[]>({
    queryKey: noteKeys.byTransaction(transactionId),
    queryFn: () => noteApi.getByTransaction(transactionId),
    enabled: !!transactionId,
  });
}

export function useClientNotes(clientId: string, opts?: { includeDeals?: boolean }) {
  return useQuery<TransactionNote[]>({
    // The option is appended AFTER clientId so `noteKeys.byClient(clientId)`
    // still prefix-matches this key for mutation invalidation.
    queryKey: [...noteKeys.byClient(clientId), { includeDeals: !!opts?.includeDeals }],
    queryFn: () => noteApi.getByClient(clientId, opts),
    enabled: !!clientId,
  });
}
