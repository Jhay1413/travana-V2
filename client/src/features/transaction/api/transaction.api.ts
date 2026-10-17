import axiosClient from "@/api/client/axios-client";
import type { Transaction, CreateTransactionData } from "@/features/quote/types";
import { appendPipelineFilterParams } from "../lib/pipeline-query";

export type PipelineSort =
  | "newest"
  | "oldest"
  | "oldest-activity"
  | "latest_activity"
  | "value_desc"
  | "profit_desc"
  | "name_asc"
  | "quiet_first";
export type PipelineQuick = "due_today" | "no_task" | "quiet_7";
export type DealPriority = "low" | "medium" | "high";

export interface PipelineQueryFilters {
  search?: string;
  priority?: DealPriority[];
  tourOperatorId?: string[];
  quick?: PipelineQuick;
}

export interface PipelineColumnPage {
  items: Transaction[];
  total: number;
  page: number;
  hasMore: boolean;
  totalValue: number;
  totalProfit: number;
}

export interface PipelineCounts {
  all: number;
  due_today: number;
  no_task: number;
  quiet_7: number;
}

export interface PipelineCountsParams {
  agentId?: string;
  branchId?: string;
  search?: string;
  priority?: DealPriority[];
  tourOperatorId?: string[];
}

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
    sort?: PipelineSort,
    branchId?: string,
    filters?: PipelineQueryFilters,
  ): Promise<PipelineColumnPage> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (agentId) params.append("agentId", agentId);
    if (quoteStatus) params.append("quoteStatus", quoteStatus);
    if (sort) params.append("sort", sort);
    if (branchId) params.append("branchId", branchId);
    appendPipelineFilterParams(params, filters);
    const { data } = await axiosClient.get(`/api/v2/transactions/pipeline/${status}?${params.toString()}`);
    return data as PipelineColumnPage;
  },

  getPipelineCounts: async (counts: PipelineCountsParams): Promise<PipelineCounts> => {
    const params = new URLSearchParams();
    if (counts.agentId) params.append("agentId", counts.agentId);
    if (counts.branchId) params.append("branchId", counts.branchId);
    appendPipelineFilterParams(params, { search: counts.search, priority: counts.priority, tourOperatorId: counts.tourOperatorId });
    const query = params.toString();
    const { data } = await axiosClient.get(`/api/v2/transactions/pipeline-counts${query ? `?${query}` : ""}`);
    return data as PipelineCounts;
  },

  getStats: async () => {
    const { data } = await axiosClient.get("/api/v2/transactions/stats");
    return data;
  },

  updatePriority: async (id: string, priority: "low" | "medium" | "high"): Promise<Transaction> => {
    const { data } = await axiosClient.patch<Transaction>(`/api/v2/transactions/${id}/priority`, { priority });
    return data;
  },

  setFutureDeal: async (id: string, futureDealDate: string | null): Promise<Transaction> => {
    const { data } = await axiosClient.post<Transaction>(`/api/v2/transactions/${id}/future`, { future_deal_date: futureDealDate });
    return data;
  },

  setLost: async (id: string, lost: boolean): Promise<Transaction> => {
    const { data } = await axiosClient.post<Transaction>(`/api/v2/transactions/${id}/lost`, { lost });
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
