import { useQuery } from "@tanstack/react-query";
import { replyApi } from "@/api";
import type { TicketReply } from "@/types/reply";

export const replyKeys = {
  all: ["replies"] as const,
  byTicket: (ticketId: string) => [...replyKeys.all, "byTicket", ticketId] as const,
};

export function useReplies(ticketId: string) {
  return useQuery<TicketReply[]>({
    queryKey: replyKeys.byTicket(ticketId),
    queryFn: () => replyApi.getByTicket(ticketId),
    enabled: !!ticketId,
  });
}
