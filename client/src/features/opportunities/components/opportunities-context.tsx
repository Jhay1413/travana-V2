import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { useOpportunityAgents } from "@/hooks/queries";
import type { DateRange, SortBy } from "./_data";

export const PAGE_SIZE = 20;

export interface FiltersState {
  search:    string;
  status:    string;
  dateRange: DateRange;
  sortBy:    SortBy;
  agentId:   string;
  page:      number;
}

export interface ApiFilters {
  page:      number;
  limit:     number;
  status:    string;
  search:    string;
  dateRange: string;
  sortBy:    string;
  agentId:   string;
}

export interface OpportunitiesContextValue {
  filters:            FiltersState;
  apiFilters:         ApiFilters;
  set:                <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
  resetForTabChange:  () => void;
  agents:             { id: string; name: string }[];
}

const OpportunitiesContext = createContext<OpportunitiesContextValue | null>(null);

export function useOpportunities(): OpportunitiesContextValue {
  const ctx = useContext(OpportunitiesContext);
  if (!ctx) throw new Error("useOpportunities must be used within OpportunitiesProvider");
  return ctx;
}

export function OpportunitiesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const currentUserId = (user as { id?: string } | null | undefined)?.id ?? "all";

  const [filters, setFilters] = useState<FiltersState>(() => ({
    search:    "",
    status:    "all",
    dateRange: "this-month",
    sortBy:    "newest",
    agentId:   currentUserId,
    page:      1,
  }));

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    setFilters((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [filters.status, filters.dateRange, filters.sortBy, filters.agentId, debouncedSearch]);

  const set = useCallback(
    <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetForTabChange = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      search:  "",
      status:  "all",
      agentId: currentUserId,
      page:    1,
    }));
  }, [currentUserId]);

  const agentsQuery = useOpportunityAgents();
  const agents = useMemo(
    () =>
      (agentsQuery.data ?? []).map((a) => ({
        id:   a.id,
        name: a.firstName || a.name,
      })),
    [agentsQuery.data],
  );

  const apiFilters = useMemo<ApiFilters>(
    () => ({
      page:      filters.page,
      limit:     PAGE_SIZE,
      status:    filters.status,
      search:    debouncedSearch,
      dateRange: filters.dateRange,
      sortBy:    filters.sortBy,
      agentId:   filters.agentId,
    }),
    [filters.page, filters.status, debouncedSearch, filters.dateRange, filters.sortBy, filters.agentId],
  );

  const value = useMemo<OpportunitiesContextValue>(
    () => ({ filters, apiFilters, set, resetForTabChange, agents }),
    [filters, apiFilters, set, resetForTabChange, agents],
  );

  return <OpportunitiesContext.Provider value={value}>{children}</OpportunitiesContext.Provider>;
}
