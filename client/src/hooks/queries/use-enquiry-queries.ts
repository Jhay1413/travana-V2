import { useQuery } from "@tanstack/react-query";
import { enquiryApi } from "@/api";
import type { Enquiry, EnquiryFilters } from "@/types/enquiry";

export const enquiryKeys = {
  all: ["enquiries"] as const,
  lists: () => [...enquiryKeys.all, "list"] as const,
  list: (filters?: EnquiryFilters) => [...enquiryKeys.lists(), filters] as const,
  details: () => [...enquiryKeys.all, "detail"] as const,
  detail: (id: string) => [...enquiryKeys.details(), id] as const,
};

export function useEnquiries(filters?: EnquiryFilters) {
  return useQuery<Enquiry[]>({
    queryKey: enquiryKeys.list(filters),
    queryFn: () => enquiryApi.getAll(filters),
    enabled: !filters?.clientId || !!filters.clientId,
  });
}

export function useEnquiry(id: string) {
  return useQuery<Enquiry>({
    queryKey: enquiryKeys.detail(id),
    queryFn: () => enquiryApi.getById(id),
    enabled: !!id,
  });
}
