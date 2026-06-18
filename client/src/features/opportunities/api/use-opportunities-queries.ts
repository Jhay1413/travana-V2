import { useQuery } from "@tanstack/react-query";
import {
  opportunitiesApi,
  type OpportunityFilters,
  type PaginatedResponse,
} from "./opportunities.api";

export const opportunitiesKeys = {
  all:       ["opportunities"] as const,
  enquiries: (filters: OpportunityFilters) => [...opportunitiesKeys.all, "enquiries", filters] as const,
  quotes:    (filters: OpportunityFilters) => [...opportunitiesKeys.all, "quotes", filters] as const,
  bookings:  (filters: OpportunityFilters) => [...opportunitiesKeys.all, "bookings", filters] as const,
  agents:    () => [...opportunitiesKeys.all, "agents"] as const,
};

export function useOpportunityEnquiries(filters: OpportunityFilters) {
  return useQuery<PaginatedResponse>({
    queryKey: opportunitiesKeys.enquiries(filters),
    queryFn: () => opportunitiesApi.getEnquiries(filters),
  });
}

export function useOpportunityQuotes(filters: OpportunityFilters) {
  return useQuery<PaginatedResponse>({
    queryKey: opportunitiesKeys.quotes(filters),
    queryFn: () => opportunitiesApi.getQuotes(filters),
  });
}

export function useOpportunityBookings(filters: OpportunityFilters) {
  return useQuery<PaginatedResponse>({
    queryKey: opportunitiesKeys.bookings(filters),
    queryFn: () => opportunitiesApi.getBookings(filters),
  });
}

export function useOpportunityAgents() {
  return useQuery<{ id: string; name: string; firstName: string }[]>({
    queryKey: opportunitiesKeys.agents(),
    queryFn: opportunitiesApi.getAgents,
  });
}
