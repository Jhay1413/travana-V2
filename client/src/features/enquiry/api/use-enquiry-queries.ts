import { useQuery } from "@tanstack/react-query";
import { enquiryApi } from "@/api";
import type { EnquiryTable } from "@/features/quote/types";

export const enquiryKeys = {
  all: ["enquiries"] as const,
  lists: () => [...enquiryKeys.all, "list"] as const,
  list: () => [...enquiryKeys.lists()] as const,
  details: () => [...enquiryKeys.all, "detail"] as const,
  detail: (id: string) => [...enquiryKeys.details(), id] as const,
  byTransaction: (txnId: string) => [...enquiryKeys.all, "byTransaction", txnId] as const,
};

export function useEnquiries() {
  return useQuery<EnquiryTable[]>({
    queryKey: enquiryKeys.list(),
    queryFn: () => enquiryApi.getAll(),
  });
}

export function useEnquiry(id: string) {
  return useQuery<EnquiryTable>({
    queryKey: enquiryKeys.detail(id),
    queryFn: () => enquiryApi.getById(id),
    enabled: !!id,
  });
}

export function useEnquiryByTransaction(transactionId: string) {
  return useQuery<EnquiryTable>({
    queryKey: enquiryKeys.byTransaction(transactionId),
    queryFn: () => enquiryApi.getByTransactionId(transactionId),
    enabled: !!transactionId,
  });
}
