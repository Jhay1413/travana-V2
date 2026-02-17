import { useMemo } from "react";
import { useNeonClient, useTransactions, useTicketsByClient } from "@/hooks/queries";
import { transformNeonClientData, transformTicket } from "../utils/transformers";
import type { Client, TicketItem } from "../utils/types";

export function useClientData(clientId: string) {
  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions(clientId);
  const { data: ticketsData, isLoading: isLoadingTickets } = useTicketsByClient(clientId);

  const client: Client | null = useMemo(() => {
    if (!clientData) return null;
    return transformNeonClientData(clientData);
  }, [clientData]);

  const tickets: TicketItem[] = useMemo(() => {
    if (!ticketsData) return [];
    return ticketsData.map(transformTicket);
  }, [ticketsData]);

  const isLoading = isLoadingClient || isLoadingTransactions || isLoadingTickets;

  return {
    client,
    clientData,
    transactions: transactionsData || [],
    tickets,
    isLoading,
  };
}
