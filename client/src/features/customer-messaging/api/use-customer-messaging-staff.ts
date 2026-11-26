import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffMessagePurpose, StaffSendInput } from "../types";
import { customerMessagingStaffApi } from "./customer-messaging-staff.api";

export const staffMessagingKeys = {
  all: ["customer-messaging-staff"] as const,
  /** Every availability answer for one client (both purposes): refresh it when their phone number or opt-out changes. */
  availabilityRoot: (clientId: string) => ["customer-messaging-staff", "availability", clientId] as const,
  availability: (clientId: string, purpose: StaffMessagePurpose) => ["customer-messaging-staff", "availability", clientId, purpose] as const,
  logRoot: (clientId: string) => ["customer-messaging-staff", "log", clientId] as const,
  preview: (clientId: string, limit: number) => ["customer-messaging-staff", "log", clientId, "preview", limit] as const,
  full: (clientId: string) => ["customer-messaging-staff", "log", clientId, "all"] as const,
};

/** Which channels can carry this message to this customer right now, and why not when one cannot. */
export function useSendAvailability(clientId: string | undefined, purpose: StaffMessagePurpose, enabled = true) {
  return useQuery({
    queryKey: staffMessagingKeys.availability(clientId ?? "", purpose),
    queryFn: () => customerMessagingStaffApi.getAvailability(clientId as string, purpose),
    enabled: enabled && !!clientId,
    // The answer depends on live settings (WhatsApp connection, opt-out): always read it fresh when a dialog opens.
    staleTime: 0,
    gcTime: 0,
  });
}

/** Sends by the chosen channel; refreshes the client's history afterwards. */
export function useStaffSend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffSendInput) => customerMessagingStaffApi.send(input),
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: staffMessagingKeys.logRoot(input.clientId) });
    },
  });
}

/** The latest few rows for the client page card. */
export function useMessageLogPreview(clientId: string, limit = 5) {
  return useQuery({
    queryKey: staffMessagingKeys.preview(clientId, limit),
    queryFn: () => customerMessagingStaffApi.getLog(clientId, { limit }),
    enabled: !!clientId,
  });
}

/** Every row, page by page ("View all"). */
export function useMessageLogPages(clientId: string, enabled: boolean, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: staffMessagingKeys.full(clientId),
    queryFn: ({ pageParam }) => customerMessagingStaffApi.getLog(clientId, { limit: pageSize, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!clientId,
  });
}
