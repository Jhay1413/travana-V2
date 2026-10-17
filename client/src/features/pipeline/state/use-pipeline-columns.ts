import { useCallback, useMemo } from "react";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { usePipelineColumn, transactionKeys } from "@/hooks/queries";
import { usePipelineCounts, type PipelineCountsParams, type PipelineQueryFilters, type PipelineSort } from "@/features/transaction";
import type { Transaction } from "@/features/quote/types";
import { ALL_STAGES, STAGE_STATUS, type PipelinePage, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { DEFAULT_PIPELINE_SORT, columnFiltersFor } from "@/features/pipeline/lib/pipeline-board-filters";

const PIPELINE_PAGE_SIZE = 10;

/** Lost has no time window, so activity sorting is expensive there: it uses
 *  newest-first unless the user picked a non-default sort. */
export function sortForStage(stage: PipelineStage, sort: PipelineSort): PipelineSort {
  return stage === "Lost" && sort === DEFAULT_PIPELINE_SORT ? "newest" : sort;
}

export interface ColumnData {
  items: Transaction[];
  total: number;
  totalValue: number;
  totalProfit: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** True while the previous filters' data is shown during a refetch. */
  isPlaceholderData: boolean;
  fetchNextPage: () => void;
}

const EMPTY_COLUMN: ColumnData = {
  items: [],
  total: 0,
  totalValue: 0,
  totalProfit: 0,
  isLoading: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  isPlaceholderData: false,
  fetchNextPage: () => undefined,
};

function flatten(data: InfiniteData<PipelinePage> | undefined) {
  if (!data?.pages?.length) return { items: [] as Transaction[], total: 0, totalValue: 0, totalProfit: 0 };
  const first = data.pages[0];
  return {
    items: data.pages.flatMap((p) => p.items),
    total: first.total || 0,
    totalValue: first.totalValue || 0,
    totalProfit: first.totalProfit || 0,
  };
}

/** Flattens one column query into stable ColumnData. A column switched off by a
 *  quick chip must look empty even if placeholder data is still held. */
function useColumnData(q: UseInfiniteQueryResult<InfiniteData<PipelinePage>>, enabled: boolean): ColumnData {
  const flat = useMemo(() => flatten(q.data), [q.data]);
  const { isLoading, hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage } = q;
  return useMemo(
    () =>
      enabled
        ? {
            ...flat,
            isLoading,
            hasNextPage: !!hasNextPage,
            isFetchingNextPage,
            isPlaceholderData,
            fetchNextPage: () => void fetchNextPage(),
          }
        : EMPTY_COLUMN,
    [enabled, flat, isLoading, hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage],
  );
}

interface Options {
  agentFilter: string | undefined;
  agentResolved: boolean;
  hideBooked: boolean;
  sort: PipelineSort;
  filters: PipelineQueryFilters;
  countsParams: PipelineCountsParams;
  withCounts: boolean;
}

/** One paged query per board column plus the quick-chip counts. */
export function usePipelineColumns({ agentFilter, agentResolved, hideBooked, sort, filters, countsParams, withCounts }: Options) {
  const per = (stage: PipelineStage) => {
    const f = columnFiltersFor(stage, filters);
    const stageEnabled = agentResolved && f.enabled && !(stage === "Booked" && hideBooked);
    return { f, stageEnabled };
  };

  const enquiry = per("Enquiry");
  const quoted = per("Quoted");
  const inPlay = per("In Play");
  const booked = per("Booked");
  const future = per("Future");
  const lost = per("Lost");

  const opts = (enabled: boolean) => ({ enabled, keepPrevious: true });
  const enquiryQ = usePipelineColumn("enquiry", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(enquiry.stageEnabled), sort, undefined, enquiry.f.filters);
  const quoteQ = usePipelineColumn("quote", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(quoted.stageEnabled), sort, undefined, quoted.f.filters);
  const inPlayQ = usePipelineColumn("in_play", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(inPlay.stageEnabled), sort, undefined, inPlay.f.filters);
  const bookingQ = usePipelineColumn("booking", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(booked.stageEnabled), sort, undefined, booked.f.filters);
  const futureQ = usePipelineColumn("future", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(future.stageEnabled), sort, undefined, future.f.filters);
  const lostQ = usePipelineColumn("lost", PIPELINE_PAGE_SIZE, agentFilter, undefined, opts(lost.stageEnabled), sortForStage("Lost", sort), undefined, lost.f.filters);
  const countsQ = usePipelineCounts(countsParams, { enabled: withCounts && agentResolved });

  const columnData = {
    Enquiry: useColumnData(enquiryQ, enquiry.stageEnabled),
    Quoted: useColumnData(quoteQ, quoted.stageEnabled),
    "In Play": useColumnData(inPlayQ, inPlay.stageEnabled),
    Booked: useColumnData(bookingQ, booked.stageEnabled),
    Future: useColumnData(futureQ, future.stageEnabled),
    Lost: useColumnData(lostQ, lost.stageEnabled),
  };
  const columns = useMemo<Record<PipelineStage, ColumnData>>(
    () => columnData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnData.Enquiry, columnData.Quoted, columnData["In Play"], columnData.Booked, columnData.Future, columnData.Lost],
  );

  // The cache key a stage's optimistic patches must target: it has to carry the
  // same sort and per-stage filters the query itself uses.
  const keyForStage = useCallback(
    (stage: PipelineStage) =>
      transactionKeys.pipeline(STAGE_STATUS[stage], agentFilter, undefined, sortForStage(stage, sort), undefined, columnFiltersFor(stage, filters).filters),
    [agentFilter, sort, filters],
  );

  const isLoading = !agentResolved || ALL_STAGES.some((s) => columns[s].isLoading);

  return { columns, keyForStage, isLoading, counts: countsQ.data };
}
