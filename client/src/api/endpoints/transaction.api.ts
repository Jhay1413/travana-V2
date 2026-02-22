import axiosClient from "../client/axios-client";
import type { Transaction, CreateTransactionData } from "@/types/quote";

export const transactionApi = {
  getAll: async (filters?: { clientId?: string; agentId?: string }): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append("clientId", filters.clientId);
    if (filters?.agentId) params.append("agentId", filters.agentId);
    const query = params.toString();
    const { data } = await axiosClient.get<Transaction[]>(`/api/transactions${query ? `?${query}` : ""}`);
    return data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const { data } = await axiosClient.get<Transaction>(`/api/transactions/${id}`);
    return data;
  },

  create: async (txnData: CreateTransactionData): Promise<Transaction> => {
    const { data } = await axiosClient.post<Transaction>("/api/transactions", txnData);
    return data;
  },

  update: async (id: string, txnData: Partial<CreateTransactionData>): Promise<Transaction> => {
    const { data } = await axiosClient.patch<Transaction>(`/api/transactions/${id}`, txnData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/transactions/${id}`);
  },

  getPipeline: async (): Promise<Transaction[]> => {
    const { data } = await axiosClient.get<Transaction[]>("/api/transactions/pipeline");
    return data;
  },

  getPipelineByStatus: async (
    status: string,
    page: number,
    limit: number,
    agentId?: string,
    quoteStatus?: string,
  ): Promise<{ items: Transaction[]; total: number; page: number; hasMore: boolean; totalProfit: number; totalValue: number }> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (agentId) params.append("agentId", agentId);
    if (quoteStatus) params.append("quoteStatus", quoteStatus);
    const { data } = await axiosClient.get(`/api/transactions/pipeline/${status}?${params.toString()}`);
    return data as { items: Transaction[]; total: number; page: number; hasMore: boolean; totalProfit: number; totalValue: number };
  },

  getStats: async () => {
    const { data } = await axiosClient.get("/api/transactions/stats");
    return data;
  },
};
