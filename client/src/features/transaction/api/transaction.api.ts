import axiosClient from "@/api/client/axios-client";
import type { Transaction, CreateTransactionData } from "@/features/quote/types";

export const transactionApi = {
  getAll: async (filters?: { clientId?: string; agentId?: string; dateFrom?: string; dateTo?: string; branchId?: string }): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append("clientId", filters.clientId);
    if (filters?.agentId) params.append("agentId", filters.agentId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.branchId) params.append("branchId", filters.branchId);
    const query = params.toString();
    const { data } = await axiosClient.get<Transaction[]>(`/api/v2/transactions${query ? `?${query}` : ""}`);
    return data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const { data } = await axiosClient.get<Transaction>(`/api/v2/transactions/${id}`);
    return data;
  },

  getWithDetails: async (id: string): Promise<Transaction> => {
    const { data } = await axiosClient.get<Transaction>(`/api/v2/transactions/${id}/details`);
    return data;
  },

  create: async (txnData: CreateTransactionData | FormData): Promise<Transaction> => {
    const config = txnData instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    const { data } = await axiosClient.post<Transaction>("/api/v2/transactions", txnData, config);
    return data;
  },

  update: async (id: string, txnData: Partial<CreateTransactionData>): Promise<Transaction> => {
    const { data } = await axiosClient.patch<Transaction>(`/api/v2/transactions/${id}`, txnData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/transactions/${id}`);
  },

  getPipeline: async (): Promise<Transaction[]> => {
    const { data } = await axiosClient.get<Transaction[]>("/api/v2/transactions/pipeline");
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
    const { data } = await axiosClient.get(`/api/v2/transactions/pipeline/${status}?${params.toString()}`);
    return data as { items: Transaction[]; total: number; page: number; hasMore: boolean; totalProfit: number; totalValue: number };
  },

  getStats: async () => {
    const { data } = await axiosClient.get("/api/v2/transactions/stats");
    return data;
  },

  getExpiringQuotes: async (agentId?: string) => {
    const params = agentId ? `?agentId=${agentId}` : "";
    const { data } = await axiosClient.get(`/api/v2/transactions/expiring-quotes${params}`);
    return data as {
      id: string;
      clientId: string | null;
      clientName: string;
      salesPrice: string | null;
      dateCreated: string | null;
      dateExpiry: string | null;
      expiryDate: string;
      status: "expired" | "near_expiry";
      transactionId: string;
    }[];
  },
};
