import axiosClient from "../client/axios-client";

export interface OpportunityFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  dateRange?: string;
  agentId?: string;
  sortBy?: string;
}

export interface OpportunityItem {
  id: string;
  transactionId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  agentName: string;
  title: string;
  status: string;
  travelDate: string | null;
  dateCreated: string | null;
  adults: number;
  children: number;
  budget?: number;
  salesPrice?: number;
  /** Final price the customer pays: sales price − discount + service charge. */
  totalPrice?: number;
  commission?: number;
  nights: number;
  haysRef?: string;
  supplierRef?: string;
}

export interface PaginatedResponse {
  items: OpportunityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildParams(filters: OpportunityFilters) {
  const params: Record<string, string> = {};
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.status && filters.status !== "all") params.status = filters.status;
  if (filters.search) params.search = filters.search;
  if (filters.dateRange && filters.dateRange !== "all-time") params.dateRange = filters.dateRange;
  if (filters.agentId && filters.agentId !== "all") params.agentId = filters.agentId;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  return params;
}

export const opportunitiesApi = {
  getEnquiries: async (filters: OpportunityFilters = {}): Promise<PaginatedResponse> => {
    const { data } = await axiosClient.get<PaginatedResponse>("/api/v2/opportunities/enquiries", { params: buildParams(filters) });
    return data;
  },

  getQuotes: async (filters: OpportunityFilters = {}): Promise<PaginatedResponse> => {
    const { data } = await axiosClient.get<PaginatedResponse>("/api/v2/opportunities/quotes", { params: buildParams(filters) });
    return data;
  },

  getBookings: async (filters: OpportunityFilters = {}): Promise<PaginatedResponse> => {
    const { data } = await axiosClient.get<PaginatedResponse>("/api/v2/opportunities/bookings", { params: buildParams(filters) });
    return data;
  },

  getAgents: async (): Promise<{ id: string; name: string; firstName: string }[]> => {
    const { data } = await axiosClient.get("/api/v2/opportunities/agents");
    return data;
  },
};
