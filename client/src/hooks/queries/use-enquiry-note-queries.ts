import { useQuery } from "@tanstack/react-query";
import { enquiryNoteApi } from "@/api/endpoints/enquiry-note.api";
import type { EnquiryNote } from "@shared/schema";

export const enquiryNoteKeys = {
  all: ["enquiry-notes"] as const,
  byEnquiry: (enquiryId: string) => [...enquiryNoteKeys.all, "byEnquiry", enquiryId] as const,
};

export function useEnquiryNotes(enquiryId: string) {
  return useQuery<EnquiryNote[]>({
    queryKey: enquiryNoteKeys.byEnquiry(enquiryId),
    queryFn: () => enquiryNoteApi.getByEnquiry(enquiryId),
    enabled: !!enquiryId,
  });
}
