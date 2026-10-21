import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { Transaction } from "@/features/quote/types";
import type { CardActions } from "@/features/pipeline/card/deal-card";
import {
  ALL_STAGES,
  getStageForTransaction,
  isValidDrop,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { activeFilterCount } from "@/features/pipeline/lib/pipeline-board-filters";
import { sumOpenTotals } from "@/features/pipeline/lib/pipeline-money";
import { PipelinePageHeader } from "@/features/pipeline/header/pipeline-page-header";
import { PipelineToolbar } from "@/features/pipeline/header/pipeline-toolbar";
import { PipelineColumn } from "@/features/pipeline/board/pipeline-column";
import { PipelineListView } from "@/features/pipeline/list/pipeline-list-view";
import { getTaskEntity } from "@/features/pipeline/lib/task-entity";
import { DealDrawer } from "@/features/pipeline/drawer/deal-drawer";
import { PipelineDialogsHost } from "@/features/pipeline/dialogs/pipeline-dialogs";
import { PipelineMobile } from "@/features/pipeline/mobile/pipeline-mobile";
import { useCollapsedStages } from "@/features/pipeline/state/use-collapsed-stages";
import { usePipelineFilters } from "@/features/pipeline/state/use-pipeline-filters";
import { usePipelineColumns } from "@/features/pipeline/state/use-pipeline-columns";
import { usePipelineCache } from "@/features/pipeline/state/use-pipeline-cache";
import { usePipelineParking } from "@/features/pipeline/state/use-pipeline-parking";
import { usePipelineDialogs } from "@/features/pipeline/state/use-pipeline-dialogs";
import { usePipelineMoves } from "@/features/pipeline/state/use-pipeline-moves";

export function PipelineBoard({
  agentId,
  embedded = false,
  hideBooked = false,
}: {
  /** When set, the board is locked to this agent — the agent selector and
   *  My/All toggle are hidden so the view can't escape the scope. Used to
   *  embed the board inside the agent dashboard's Pipeline tab. */
  agentId?: string;
  /** Embedded mode: drop the page-level title, My/All toggle, chips and New deal. */
  embedded?: boolean;
  /** Hide the Booked column (and skip fetching it). Used by the dashboard tab. */
  hideBooked?: boolean;
} = {}) {
  const isMobile = useMediaQuery("(max-width: 900px)") && !embedded;
  const f = usePipelineFilters(agentId);
  const { collapsed, toggleCollapse } = useCollapsedStages();
  const dialogs = usePipelineDialogs();
  const { setSelectedDeal, setFutureDialog, setLostConfirm, setNewDealOpen } = dialogs;
  const [dragState, setDragState] = useState<{ active: boolean; fromStage: PipelineStage | null }>({ active: false, fromStage: null });

  const { columns, keyForStage, isLoading, counts } = usePipelineColumns({
    agentFilter: f.agentFilter,
    agentResolved: f.agentResolved,
    hideBooked,
    sort: f.sort,
    filters: f.filters,
    countsParams: f.countsParams,
    withCounts: !embedded,
  });
  const cache = usePipelineCache(keyForStage);
  const parking = usePipelineParking(cache, useCallback(() => setFutureDialog(null), [setFutureDialog]), !!f.filters.priority?.length);
  const moves = usePipelineMoves(cache, parking, dialogs);

  const visibleStages = useMemo(() => (hideBooked ? ALL_STAGES.filter((s) => s !== "Booked") : ALL_STAGES), [hideBooked]);
  const allTx = useMemo(() => ALL_STAGES.flatMap((s) => columns[s].items), [columns]);
  const totals = useMemo(() => sumOpenTotals(columns), [columns]);

  const clientNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const tx of allTx) if (tx.client_id && tx.client_name) m.set(tx.client_id, tx.client_name);
    return m;
  }, [allTx]);
  const getName = useCallback((id: string | null) => (id ? clientNames.get(id) || "Unknown Client" : "Unknown Client"), [clientNames]);

  const openDrawer = useCallback((tx: Transaction, stage: PipelineStage) => setSelectedDeal({ tx, stage }), [setSelectedDeal]);
  // Only pre-open the Add task pop-up when the deal has a record to attach the task to.
  const openDrawerWithTask = useCallback(
    (tx: Transaction, stage: PipelineStage) => setSelectedDeal({ tx, stage, addTask: !!getTaskEntity(tx, stage).id }),
    [setSelectedDeal],
  );
  const addQuote = useCallback(
    (tx: Transaction, stage: PipelineStage) => {
      if (getStageForTransaction(tx) === "Enquiry" && stage !== "Lost") moves.applyStageTransition(tx, "Enquiry", "Quoted");
      else openDrawer(tx, stage);
    },
    [moves, openDrawer],
  );

  const actionsFor = useCallback(
    (stage: PipelineStage): CardActions => ({
      onCardClick: openDrawer,
      onSetPriority: (t, p) => parking.handleSetPriority(t, p, stage),
      onMoveToFuture: (t) => setFutureDialog({ tx: t, fromStage: stage }),
      onReturnToPipeline: parking.handleReturnToPipeline,
      onMarkLost: (t) => setLostConfirm({ tx: t, stage }),
      onRestore: (t) => parking.handleSetLost(t, stage, false),
      onAddQuote: (t) => addQuote(t, stage),
      onAddTask: (t) => openDrawerWithTask(t, stage),
    }),
    [addQuote, openDrawer, openDrawerWithTask, parking, setFutureDialog, setLostConfirm],
  );

  const handleDragStart = useCallback((_t: Transaction, s: PipelineStage) => setDragState({ active: true, fromStage: s }), []);
  const handleDrop = useCallback(
    (txId: string, from: PipelineStage, to: PipelineStage) => {
      setDragState({ active: false, fromStage: null });
      const tx = allTx.find((t) => t.id === txId);
      if (tx) moves.moveDealTo(tx, from, to);
    },
    [allTx, moves],
  );

  // Keep the drawer on the freshest copy of its deal (priority edits, refetches).
  const selected = dialogs.selectedDeal
    ? { tx: allTx.find((t) => t.id === dialogs.selectedDeal?.tx.id) ?? dialogs.selectedDeal.tx, stage: dialogs.selectedDeal.stage }
    : null;
  const selectedId = selected?.tx.id ?? null;
  const closeDrawer = () => setSelectedDeal(null);

  return (
    <>
      <div
        className={cn("flex min-h-0 min-w-0 flex-col gap-3.5 text-[14px] leading-[1.5]", !embedded && "min-h-[calc(100vh-7rem)]")}
        onDragEnd={() => setDragState({ active: false, fromStage: null })}
      >
        {isMobile ? (
          <PipelineMobile
            columns={columns}
            stages={visibleStages}
            isLoading={isLoading}
            searchInput={f.searchInput}
            onSearchChange={f.setSearchInput}
            scope={f.scope}
            onScopeChange={f.setScope}
            onNewDeal={() => setNewDealOpen(true)}
            activeFilters={activeFilterCount(f.priority, f.operators) + (f.quick ? 1 : 0)}
            onClearFilters={() => {
              f.clearFilters();
              f.setQuick(null);
            }}
            getClientName={getName}
            selectedId={selectedId}
            onDragStart={handleDragStart}
            actionsFor={actionsFor}
          />
        ) : (
          <>
            <PipelinePageHeader
              embedded={embedded}
              totals={totals}
              searchInput={f.searchInput}
              onSearchChange={f.setSearchInput}
              priority={f.priority}
              operators={f.operators}
              onTogglePriority={f.togglePriority}
              onToggleOperator={f.toggleOperator}
              onClearFilters={f.clearFilters}
              sort={f.sort}
              onSortChange={f.setSort}
              onNewDeal={() => setNewDealOpen(true)}
            />
            <PipelineToolbar
              embedded={embedded}
              view={f.view}
              onViewChange={f.setView}
              scope={f.scope}
              onScopeChange={f.setScope}
              selectedAgentId={f.selectedAgentId}
              onSelectedAgentIdChange={f.setSelectedAgentId}
              quick={f.quick}
              onQuickChange={f.setQuick}
              counts={counts}
            />

            {f.view === "board" ? (
              <div className="flex min-h-[560px] min-w-0 flex-1 gap-3 overflow-x-auto">
                {visibleStages.map((stage) => (
                  <PipelineColumn
                    key={stage}
                    stage={stage}
                    column={columns[stage]}
                    collapsed={!!collapsed[stage]}
                    onToggleCollapse={() => toggleCollapse(stage)}
                    isDragActive={dragState.active}
                    dragFromStage={dragState.fromStage}
                    isValidDrop={isValidDrop}
                    selectedId={selectedId}
                    getClientName={getName}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    {...actionsFor(stage)}
                  />
                ))}
              </div>
            ) : (
              <PipelineListView
                columns={columns}
                stages={visibleStages}
                isLoading={isLoading}
                selectedId={selectedId}
                getClientName={getName}
                onRowClick={openDrawer}
                onAddTask={openDrawerWithTask}
              />
            )}
          </>
        )}
      </div>

      <PipelineDialogsHost dialogs={dialogs} parking={parking} allowNewDeal={!embedded} />

      {selected && (
        <DealDrawer
          key={selected.tx.id}
          initialAddTask={dialogs.selectedDeal?.addTask}
          onTaskCreated={() => {
            cache.invalidateStage(selected.stage);
          }}
          transaction={selected.tx}
          stage={selected.stage}
          clientName={getName(selected.tx.client_id)}
          onClose={closeDrawer}
          onMove={(to) => {
            moves.moveDealTo(selected.tx, selected.stage, to);
            closeDrawer();
          }}
          onMarkLost={() => {
            // Close the drawer first: the confirm dialog would otherwise sit underneath it.
            closeDrawer();
            setLostConfirm({ tx: selected.tx, stage: selected.stage });
          }}
          onAddQuote={() => {
            closeDrawer();
            addQuote(selected.tx, selected.stage);
          }}
        />
      )}
    </>
  );
}
