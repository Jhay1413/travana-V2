import { useQuery } from "@tanstack/react-query";
import { attachmentApi } from "@/api";
import type { TicketAttachment } from "@/types/attachment";

export const attachmentKeys = {
  all: ["attachments"] as const,
  byTicket: (ticketId: string) => [...attachmentKeys.all, "byTicket", ticketId] as const,
};

export function useAttachments(ticketId: string, options?: { enabled?: boolean }) {
  return useQuery<TicketAttachment[]>({
    queryKey: attachmentKeys.byTicket(ticketId),
    queryFn: () => attachmentApi.getByTicket(ticketId),
    enabled: !!ticketId && (options?.enabled ?? true),
  });
}

export function getAttachmentDownloadUrl(id: string): string {
  return `/api/attachments/${id}/download`;
}
