import { useMutation } from "@tanstack/react-query";
import { aiEnquiryApi } from "./ai-enquiry.api";

// Sends a conversation transcript to the AI and returns a drafted enquiry intent.
export function useGenerateEnquiryFromConversation() {
  return useMutation({
    mutationFn: (transcript: string) => aiEnquiryApi.fromConversation(transcript),
  });
}
