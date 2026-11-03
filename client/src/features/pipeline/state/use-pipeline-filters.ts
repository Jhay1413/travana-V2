import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrentUser } from "@/hooks/queries";
import type { DealPriority, PipelineCountsParams, PipelineQueryFilters, PipelineQuick, PipelineSort } from "@/features/transaction";
import { DEFAULT_PIPELINE_SORT, toggleInSet } from "@/features/pipeline/lib/pipeline-board-filters";

export type PipelineView = "board" | "list";
export type PipelineScope = "mine" | "all";

const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MAX_LENGTH = 100;

/** All the page-level filter state of the pipeline: view, My/All scope, agent,
 *  search (debounced), priority / operator filters, sort and the quick chip. */
export function usePipelineFilters(lockedAgentId?: string) {
  const { data: currentUser } = useCurrentUser();
  const lockAgent = !!lockedAgentId;

  const [view, setView] = useState<PipelineView>("board");
  // Seed from the persisted auth store so we know the current agent on the very
  // first render (no empty window) and never fire an all-agents fetch by accident.
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    () => lockedAgentId ?? useAuthStore.getState().user?.id ?? "",
  );
  const [scope, setScopeState] = useState<PipelineScope>("mine");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<ReadonlySet<DealPriority>>(new Set());
  const [operators, setOperators] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<PipelineSort>(DEFAULT_PIPELINE_SORT);
  const [quick, setQuick] = useState<PipelineQuick | null>(null);

  useEffect(() => {
    if (lockAgent) {
      if (lockedAgentId && lockedAgentId !== selectedAgentId) setSelectedAgentId(lockedAgentId);
      return;
    }
    if (currentUser?.id && !selectedAgentId) setSelectedAgentId(currentUser.id);
  }, [lockAgent, lockedAgentId, currentUser?.id, selectedAgentId]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().slice(0, SEARCH_MAX_LENGTH)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setScope = useCallback(
    (next: PipelineScope) => {
      setScopeState(next);
      if (next === "mine" && currentUser?.id) setSelectedAgentId(currentUser.id);
      else if (next === "all") setSelectedAgentId("all");
    },
    [currentUser?.id],
  );

  const togglePriority = useCallback((p: DealPriority) => setPriority((s) => toggleInSet(s, p)), []);
  const toggleOperator = useCallback((id: string) => setOperators((s) => toggleInSet(s, id)), []);
  const clearFilters = useCallback(() => {
    setPriority(new Set());
    setOperators(new Set());
  }, []);

  const agentFilter = selectedAgentId && selectedAgentId !== "all" ? selectedAgentId : undefined;
  // Don't fetch until the agent selection is resolved — avoids a spurious
  // all-agents fetch while selectedAgentId is still "".
  const agentResolved = !!selectedAgentId;

  const filters = useMemo<PipelineQueryFilters>(
    () => ({
      search: search || undefined,
      priority: priority.size ? [...priority] : undefined,
      tourOperatorId: operators.size ? [...operators] : undefined,
      quick: quick ?? undefined,
    }),
    [search, priority, operators, quick],
  );

  const countsParams = useMemo<PipelineCountsParams>(
    () => ({
      agentId: agentFilter,
      search: filters.search,
      priority: filters.priority,
      tourOperatorId: filters.tourOperatorId,
    }),
    [agentFilter, filters.search, filters.priority, filters.tourOperatorId],
  );

  return {
    currentUserId: currentUser?.id,
    view,
    setView,
    scope,
    setScope,
    selectedAgentId,
    setSelectedAgentId,
    searchInput,
    setSearchInput,
    priority,
    togglePriority,
    operators,
    toggleOperator,
    clearFilters,
    sort,
    setSort,
    quick,
    setQuick,
    agentFilter,
    agentResolved,
    filters,
    countsParams,
  };
}

export type PipelineFilterState = ReturnType<typeof usePipelineFilters>;
