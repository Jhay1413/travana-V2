import { useState, useMemo, useCallback, useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { usePipelineColumn, useCurrentUser, transactionKeys } from "@/hooks/queries";
import {
  useUpdateTransaction,
  useConvertToBooking,
  useUpdateQuote,
  useUpdateEnquiry,
  useUpdateDealPriority,
  useSetFutureDeal,
  useSetDealLost,
} from "@/hooks/mutations";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import { enquiryApi } from "@/api";
import { enquiryKeys } from "@/features/enquiry/api/use-enquiry-queries";
import type { Transaction } from "@/features/quote/types";
import type { QuoteFormValues } from "@/features/quote/types/quote-form.types";
import {
  ALL_STAGES,
  DEFAULT_COLLAPSED_STAGES,
  STAGE_STATUS,
  STAGE_TO_STATUS,
  getStageForTransaction,
  isValidDrop,
  type PipelinePage,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { PipelineHeader, type PipelineViewMode } from "@/features/pipeline/components/pipeline-header";
import { PipelineColumn } from "@/features/pipeline/components/pipeline-column";
import { cn } from "@/lib/utils";
import { PipelineListView, type PipelineListItem } from "@/features/pipeline/components/pipeline-list-view";
import { TransactionDetailPanel } from "@/features/pipeline/components/transaction-detail-panel";
import { MoveToFutureDialog } from "@/features/pipeline/components/move-to-future-dialog";

type Priority = "low" | "medium" | "high";

const PIPELINE_PAGE_SIZE = 10;
const COLLAPSE_STORAGE_KEY = "pipeline.collapsed";

function loadCollapsedState(): Partial<Record<PipelineStage, boolean>> {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Partial<Record<PipelineStage, boolean>>) : {};
  } catch {
    return {};
  }
}

function saveCollapsedState(state: Partial<Record<PipelineStage, boolean>>) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota) — collapse state just won't persist.
  }
}

function flattenPipelinePage(data: InfiniteData<PipelinePage> | undefined): { items: Transaction[]; total: number } {
  if (!data?.pages) return { items: [], total: 0 };
  return { items: data.pages.flatMap((p) => p.items), total: data.pages[0]?.total || 0 };
}

export function PipelineBoard({
  agentId,
  embedded = false,
  hideBooked = false,
}: {
  /** When set, the board is locked to this agent — the agent selector and
   *  My/All toggle are hidden so the view can't escape the scope. Used to
   *  embed the board inside the agent dashboard's Pipeline tab. */
  agentId?: string;
  /** Embedded mode: drop the page-level title and the My/All Deals toggle. */
  embedded?: boolean;
  /** Hide the Booked column (and skip fetching it). Used by the dashboard tab. */
  hideBooked?: boolean;
} = {}) {
  const lockAgent = !!agentId;
  const { data: currentUser } = useCurrentUser();
  const updateTransactionMutation = useUpdateTransaction();
  const updateQuoteMutation = useUpdateQuote();
  const convertToBookingMutation = useConvertToBooking();
  const updateEnquiryMutation = useUpdateEnquiry();
  const updatePriorityMutation = useUpdateDealPriority();
  const setFutureDealMutation = useSetFutureDeal();
  const setDealLostMutation = useSetDealLost();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<PipelineViewMode>("board");
  // Seed from the persisted auth store so we know the current agent on the very
  // first render (no empty window) and never fire an all-agents fetch by accident.
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => agentId ?? useAuthStore.getState().user?.id ?? "");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "mine">("mine");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsed, setCollapsed] = useState<Partial<Record<PipelineStage, boolean>>>(() => {
    const stored = loadCollapsedState();
    const initial: Partial<Record<PipelineStage, boolean>> = {};
    for (const stage of ALL_STAGES) initial[stage] = stored[stage] ?? DEFAULT_COLLAPSED_STAGES.includes(stage);
    return initial;
  });
  const [quoteDialog, setQuoteDialog] = useState<{
    transactionId: string;
    clientId: string;
    userId: string;
    initialValues?: Partial<QuoteFormValues>;
    enquiryId?: string;
  } | null>(null);
  const [bookingDialog, setBookingDialog] = useState<{ quoteId: string } | null>(null);
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<{ transaction: Transaction; stage: PipelineStage } | null>(null);
  const [futureDialogTx, setFutureDialogTx] = useState<{ tx: Transaction; fromStage: PipelineStage } | null>(null);

  useEffect(() => {
    if (lockAgent) {
      if (agentId && agentId !== selectedAgentId) setSelectedAgentId(agentId);
      return;
    }
    if (currentUser?.id && !selectedAgentId) setSelectedAgentId(currentUser.id);
  }, [lockAgent, agentId, currentUser?.id, selectedAgentId]);

  const toggleCollapse = useCallback((stage: PipelineStage) => {
    setCollapsed((prev) => {
      const next = { ...prev, [stage]: !prev[stage] };
      saveCollapsedState(next);
      return next;
    });
  }, []);

  const agentFilter = selectedAgentId && selectedAgentId !== "all" ? selectedAgentId : undefined;
  const quoteStatusParam = quoteStatusFilter !== "all" ? quoteStatusFilter : undefined;
  // Don't fetch until the agent selection is resolved — avoids a spurious
  // all-agents fetch while selectedAgentId is still "".
  const agentResolved = !!selectedAgentId;

  const enquiryQ = usePipelineColumn("enquiry", PIPELINE_PAGE_SIZE, agentFilter, undefined, { enabled: agentResolved });
  const quoteQ = usePipelineColumn("quote", PIPELINE_PAGE_SIZE, agentFilter, quoteStatusParam, { enabled: agentResolved });
  const inPlayQ = usePipelineColumn("in_play", PIPELINE_PAGE_SIZE, agentFilter, undefined, { enabled: agentResolved });
  const bookingQ = usePipelineColumn("booking", PIPELINE_PAGE_SIZE, agentFilter, undefined, { enabled: agentResolved && !hideBooked });
  const futureQ = usePipelineColumn("future", PIPELINE_PAGE_SIZE, agentFilter, undefined, { enabled: agentResolved });
  const lostQ = usePipelineColumn("lost", PIPELINE_PAGE_SIZE, agentFilter, undefined, { enabled: agentResolved });

  const qMap: Record<PipelineStage, typeof enquiryQ> = {
    Enquiry: enquiryQ, Quoted: quoteQ, "In Play": inPlayQ, Booked: bookingQ, Future: futureQ, Lost: lostQ,
  };

  const enquiryFlat = useMemo(() => flattenPipelinePage(enquiryQ.data), [enquiryQ.data]);
  const quoteFlat = useMemo(() => flattenPipelinePage(quoteQ.data), [quoteQ.data]);
  const inPlayFlat = useMemo(() => flattenPipelinePage(inPlayQ.data), [inPlayQ.data]);
  const bookingFlat = useMemo(() => flattenPipelinePage(bookingQ.data), [bookingQ.data]);
  const futureFlat = useMemo(() => flattenPipelinePage(futureQ.data), [futureQ.data]);
  const lostFlat = useMemo(() => flattenPipelinePage(lostQ.data), [lostQ.data]);

  const dMap: Record<PipelineStage, { items: Transaction[]; total: number }> = {
    Enquiry: enquiryFlat, Quoted: quoteFlat, "In Play": inPlayFlat, Booked: bookingFlat, Future: futureFlat, Lost: lostFlat,
  };

  const visibleStages = hideBooked ? ALL_STAGES.filter((s) => s !== "Booked") : ALL_STAGES;

  const [dragState, setDragState] = useState<{ active: boolean; fromStage: PipelineStage | null }>({ active: false, fromStage: null });

  const combinedItems: PipelineListItem[] = useMemo(
    () => visibleStages.flatMap((stage) => dMap[stage].items.map((transaction) => ({ transaction, stage }))),
    [visibleStages, dMap],
  );
  const allTx = useMemo(() => combinedItems.map((i) => i.transaction), [combinedItems]);

  // Names come from each transaction's own `client_name` (joined server-side).
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const tx of allTx) {
      if (tx.client_id && tx.client_name) m.set(tx.client_id, tx.client_name);
    }
    return m;
  }, [allTx]);
  const getName = useCallback((id: string | null) => (id ? clientMap.get(id) || "Unknown Client" : "Unknown Client"), [clientMap]);

  const keyForStage = useCallback(
    (stage: PipelineStage) => transactionKeys.pipeline(STAGE_STATUS[stage], agentFilter, stage === "Quoted" ? quoteStatusParam : undefined),
    [agentFilter, quoteStatusParam],
  );

  const handleDragStart = useCallback((_t: Transaction, s: PipelineStage) => {
    setDragState({ active: true, fromStage: s });
  }, []);

  const handleCardClick = useCallback((t: Transaction, s: PipelineStage) => {
    setSelectedDeal({ transaction: t, stage: s });
  }, []);

  const handleSetPriority = useCallback((tx: Transaction, priority: Priority, stage: PipelineStage) => {
    const key = keyForStage(stage);
    const prev = queryClient.getQueryData<InfiniteData<PipelinePage>>(key);
    queryClient.setQueryData<InfiniteData<PipelinePage>>(key, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((t) => (t.id === tx.id ? { ...t, priority } : t)),
        })),
      };
    });
    // Note: the mutation invalidates nothing on success — this optimistic
    // patch is the only cache update, so a stray invalidation wouldn't reset
    // every column's paging. On error, roll back and refetch the real state.
    updatePriorityMutation.mutate(
      { id: tx.id, priority },
      {
        onError: () => {
          queryClient.setQueryData(key, prev);
          queryClient.invalidateQueries({ queryKey: key });
          toast({ title: "Failed to update priority", variant: "destructive" });
        },
      },
    );
  }, [keyForStage, queryClient, toast, updatePriorityMutation]);

  // Removes a card from a column's cache immediately (used for Lost / Future
  // moves, which drop the card off its current column).
  const removeFromColumn = useCallback((stage: PipelineStage, txId: string) => {
    const key = keyForStage(stage);
    const prev = queryClient.getQueryData<InfiniteData<PipelinePage>>(key);
    queryClient.setQueryData<InfiniteData<PipelinePage>>(key, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.filter((t) => t.id !== txId),
          total: Math.max(0, (p.total ?? 0) - 1),
        })),
      };
    });
    return prev;
  }, [keyForStage, queryClient]);

  const handleSetLost = useCallback((tx: Transaction, fromStage: PipelineStage, lost: boolean) => {
    const prev = removeFromColumn(fromStage, tx.id);
    setDealLostMutation.mutate(
      { id: tx.id, lost },
      {
        onSuccess: () => toast({ title: lost ? "Deal marked as lost" : "Deal restored" }),
        onError: () => {
          queryClient.setQueryData(keyForStage(fromStage), prev);
          toast({ title: lost ? "Failed to mark as lost" : "Failed to restore", variant: "destructive" });
        },
      },
    );
  }, [keyForStage, queryClient, removeFromColumn, setDealLostMutation, toast]);

  const handleMoveToFuture = useCallback((tx: Transaction, fromStage: PipelineStage) => {
    setFutureDialogTx({ tx, fromStage });
  }, []);

  const handleConfirmFuture = useCallback((date: string) => {
    if (!futureDialogTx) return;
    const { tx, fromStage } = futureDialogTx;
    removeFromColumn(fromStage, tx.id);
    setFutureDealMutation.mutate(
      { id: tx.id, futureDealDate: date },
      {
        onSuccess: () => toast({ title: "Moved to Future" }),
        onError: () => {
          toast({ title: "Failed to move to Future", variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: keyForStage(fromStage) });
        },
        onSettled: () => setFutureDialogTx(null),
      },
    );
  }, [futureDialogTx, keyForStage, queryClient, removeFromColumn, setFutureDealMutation, toast]);

  const handleReturnToPipeline = useCallback((tx: Transaction) => {
    removeFromColumn("Future", tx.id);
    setFutureDealMutation.mutate(
      { id: tx.id, futureDealDate: null },
      {
        onSuccess: () => toast({ title: "Returned to pipeline" }),
        onError: () => { toast({ title: "Failed to return to pipeline", variant: "destructive" }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
      },
    );
  }, [queryClient, removeFromColumn, setFutureDealMutation, toast]);

  // Handles every move that isn't Future/Lost — i.e. the original board's
  // stage transitions (enquiry → quote dialog, quote/in-play → booking
  // dialog, quoted ↔ in-play, and the generic status fallback).
  const applyStageTransition = useCallback((tx: Transaction, from: PipelineStage, to: PipelineStage) => {
    if (from === "Enquiry" && to === "Quoted") {
      const baseDialog = { transactionId: tx.id, clientId: tx.client_id || "", userId: tx.user_id || currentUser?.id || "" };
      if (tx.enquiry?.id) {
        const enquiryId = tx.enquiry.id;
        void (async () => {
          try {
            const enq = await queryClient.fetchQuery({
              queryKey: enquiryKeys.detail(enquiryId),
              queryFn: () => enquiryApi.getById(enquiryId),
            });
            setQuoteDialog({ ...baseDialog, initialValues: buildQuoteInitialValuesFromEnquiry(enq), enquiryId });
          } catch {
            toast({ title: "Failed to load enquiry details", variant: "destructive" });
          }
        })();
      } else {
        setQuoteDialog(baseDialog);
      }
      return;
    }

    if ((from === "Quoted" || from === "In Play") && to === "Booked") {
      const aq = tx.quotes?.find((q) => !q.isFreeQuote && !q.isQuoteCopy) ?? tx.quotes?.find((q) => !q.isFreeQuote);
      if (!aq) { toast({ title: "No quote found", variant: "destructive" }); return; }
      setHaysRef(""); setTourRef(""); setBookingDialog({ quoteId: aq.id });
      return;
    }

    if ((to === "In Play" || to === "Quoted") && (from === "Quoted" || from === "In Play")) {
      const primaryQuote =
        tx.quote_variants?.find((v) => v.isQuoteCopy === false) ??
        tx.quote_variants?.[0] ??
        tx.quotes?.find((q) => !q.isQuoteCopy) ??
        tx.quotes?.[0];
      if (!primaryQuote) { toast({ title: "No quote found", variant: "destructive" }); return; }
      const newQuoteStatus = to === "In Play" ? "in_play" : "quoted";

      const sourceKey = keyForStage(from);
      const targetKey = keyForStage(to);
      const prevSource = queryClient.getQueryData<InfiniteData<PipelinePage>>(sourceKey);
      const prevTarget = queryClient.getQueryData<InfiniteData<PipelinePage>>(targetKey);

      const movedTx = {
        ...tx,
        quote_variants: (tx.quote_variants ?? []).map((v) => (v.isQuoteCopy === false ? { ...v, quote_status: newQuoteStatus } : v)),
        quotes: (tx.quotes ?? []).map((q) => (!q.isQuoteCopy ? { ...q, quote_status: newQuoteStatus } : q)),
      };

      queryClient.setQueryData<InfiniteData<PipelinePage>>(sourceKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.filter((t) => t.id !== tx.id),
            total: Math.max(0, (p.total ?? 0) - 1),
          })),
        };
      });
      queryClient.setQueryData<InfiniteData<PipelinePage>>(targetKey, (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((p, i) => ({
            ...p,
            items: i === 0 ? [movedTx, ...p.items.filter((t) => t.id !== tx.id)] : p.items,
            total: (p.total ?? 0) + 1,
          })),
        };
      });

      updateQuoteMutation.mutate(
        { id: primaryQuote.id, data: { quote_status: newQuoteStatus } },
        {
          onError: () => {
            queryClient.setQueryData(sourceKey, prevSource);
            queryClient.setQueryData(targetKey, prevTarget);
            toast({ title: "Error moving transaction", variant: "destructive" });
          },
          onSettled: () => {
            queryClient.invalidateQueries({ queryKey: sourceKey });
            queryClient.invalidateQueries({ queryKey: targetKey });
          },
        },
      );
      return;
    }

    const status = STAGE_TO_STATUS[to];
    if (!status) return;
    updateTransactionMutation.mutate(
      { id: tx.id, data: { status } },
      {
        onSuccess: () => { toast({ title: `Moved to ${to}` }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
        onError: () => { toast({ title: "Error moving transaction", variant: "destructive" }); },
      },
    );
  }, [currentUser, keyForStage, queryClient, toast, updateQuoteMutation, updateTransactionMutation]);

  const handleDrop = useCallback((txId: string, from: PipelineStage, to: PipelineStage) => {
    setDragState({ active: false, fromStage: null });
    if (from === to) return;
    const tx = allTx.find((t) => t.id === txId);
    if (!tx) return;

    if (to === "Lost" && from === "Booked") {
      toast({ title: "Bookings can't be marked as lost", variant: "destructive" });
      return;
    }

    // A lost deal can't move directly onto Booked (or any stage besides
    // Enquiry/Quoted/In Play/Future) — the server has no transition for
    // that. Restore it first, then chain into the requested column.
    if (from === "Lost") {
      if (to === "Future") {
        const prev = removeFromColumn("Lost", tx.id);
        setDealLostMutation.mutate(
          { id: tx.id, lost: false },
          {
            onSuccess: () => setFutureDialogTx({ tx, fromStage: getStageForTransaction(tx) }),
            onError: () => {
              queryClient.setQueryData(keyForStage("Lost"), prev);
              toast({ title: "Failed to restore deal", variant: "destructive" });
            },
          },
        );
        return;
      }

      if (to === "Enquiry" || to === "Quoted") {
        handleSetLost(tx, from, false);
        return;
      }

      if (to === "In Play") {
        const prev = removeFromColumn("Lost", tx.id);
        setDealLostMutation.mutate(
          { id: tx.id, lost: false },
          {
            onSuccess: () => {
              const naturalStage = getStageForTransaction(tx);
              if (naturalStage === "In Play") { toast({ title: "Deal restored" }); return; }
              applyStageTransition(tx, naturalStage, "In Play");
            },
            onError: () => {
              queryClient.setQueryData(keyForStage("Lost"), prev);
              toast({ title: "Failed to restore deal", variant: "destructive" });
            },
          },
        );
        return;
      }

      toast({ title: "Restore the deal first", variant: "destructive" });
      return;
    }

    if (to === "Future") {
      setFutureDialogTx({ tx, fromStage: from });
      return;
    }

    if (to === "Lost") {
      handleSetLost(tx, from, true);
      return;
    }

    if (from === "Future") {
      const naturalStage = getStageForTransaction(tx);
      removeFromColumn("Future", tx.id);
      setFutureDealMutation.mutate(
        { id: tx.id, futureDealDate: null },
        {
          onSuccess: () => {
            toast({ title: "Returned to pipeline" });
            if (to !== naturalStage) applyStageTransition(tx, naturalStage, to);
          },
          onError: () => { toast({ title: "Failed to return to pipeline", variant: "destructive" }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
        },
      );
      return;
    }

    applyStageTransition(tx, from, to);
  }, [allTx, applyStageTransition, handleSetLost, keyForStage, queryClient, removeFromColumn, setDealLostMutation, setFutureDealMutation, toast]);

  const isLoading = !agentResolved || enquiryQ.isLoading || quoteQ.isLoading || inPlayQ.isLoading || (!hideBooked && bookingQ.isLoading) || futureQ.isLoading || lostQ.isLoading;

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          !embedded && "-m-4 min-h-[calc(100vh-3.5rem)] rounded-tl-lg bg-white dark:bg-background md:-m-6",
        )}
        onDragEnd={() => setDragState({ active: false, fromStage: null })}
      >
        <PipelineHeader
          embedded={embedded}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((v) => !v)}
          activeFilter={activeFilter}
          onActiveFilterChange={(f) => {
            setActiveFilter(f);
            if (f === "mine" && currentUser?.id) setSelectedAgentId(currentUser.id);
            else setSelectedAgentId("all");
          }}
          quoteStatusFilter={quoteStatusFilter}
          onQuoteStatusChange={setQuoteStatusFilter}
          selectedAgentId={selectedAgentId}
          onSelectedAgentIdChange={setSelectedAgentId}
        />

        {viewMode === "board" && (
          <div className={cn("min-h-0 flex-1 overflow-x-auto", !embedded && "px-4 pb-4 md:px-6 md:pb-6")}>
            <div className="flex h-full min-h-[560px] rounded-lg border border-black/10 bg-white">
              {visibleStages.map((stage, index) => {
                const q = qMap[stage];
                const d = dMap[stage];
                return (
                  <PipelineColumn
                    key={stage}
                    stage={stage}
                    index={index}
                    transactions={d.items}
                    total={d.total}
                    isLoading={q.isLoading}
                    hasNextPage={!!q.hasNextPage}
                    isFetchingNextPage={q.isFetchingNextPage}
                    fetchNextPage={q.fetchNextPage}
                    collapsed={!!collapsed[stage]}
                    onToggleCollapse={() => toggleCollapse(stage)}
                    isDragActive={dragState.active}
                    dragFromStage={dragState.fromStage}
                    isValidDrop={isValidDrop}
                    getClientName={getName}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onCardClick={handleCardClick}
                    onSetPriority={(t, p) => handleSetPriority(t, p, stage)}
                    onMoveToFuture={(t) => handleMoveToFuture(t, stage)}
                    onReturnToPipeline={handleReturnToPipeline}
                    onMarkLost={(t) => handleSetLost(t, stage, true)}
                    onRestore={(t) => handleSetLost(t, stage, false)}
                  />
                );
              })}
            </div>
            {dragState.active && <p className="pb-2 pt-3 text-center text-xs text-gray-400 animate-pulse">Drag to a column to move this deal</p>}
          </div>
        )}

        {viewMode === "list" && (
          <div className={cn("min-h-0 flex-1", !embedded && "px-4 pb-4 md:px-6 md:pb-6")}>
            <PipelineListView items={combinedItems} getClientName={getName} isLoading={isLoading} onRowClick={handleCardClick} />
          </div>
        )}
      </div>

      {quoteDialog && (
        <QuoteCreateDialog
          transactionId={quoteDialog.transactionId}
          clientId={quoteDialog.clientId}
          userId={quoteDialog.userId}
          initialValues={quoteDialog.initialValues}
          open={!!quoteDialog}
          onOpenChange={(o) => { if (!o) setQuoteDialog(null); }}
          onSuccess={() => {
            if (quoteDialog.enquiryId) {
              updateEnquiryMutation.mutate({ id: quoteDialog.enquiryId, data: { status: "Converted" } });
            }
            setQuoteDialog(null);
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            toast({ title: "Quote created" });
          }}
        />
      )}

      <Dialog open={!!bookingDialog} onOpenChange={(o) => { if (!o) { setBookingDialog(null); setHaysRef(""); setTourRef(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Enter the booking references to confirm.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">HAYS Reference</Label>
              <Input value={haysRef} onChange={(e) => setHaysRef(e.target.value)} placeholder="e.g. HAYS-12345" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Tour Reference</Label>
              <Input value={tourRef} onChange={(e) => setTourRef(e.target.value)} placeholder="e.g. TOUR-67890" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <Button
              className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
              disabled={convertToBookingMutation.isPending}
              onClick={() => {
                if (!bookingDialog) return;
                convertToBookingMutation.mutate(
                  { quoteId: bookingDialog.quoteId, haysRef, supplierRef: tourRef },
                  {
                    onSuccess: () => { setBookingDialog(null); setHaysRef(""); setTourRef(""); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Converted to booking" }); },
                    onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
                  },
                );
              }}
            >
              {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MoveToFutureDialog
        open={!!futureDialogTx}
        onOpenChange={(o) => { if (!o) setFutureDialogTx(null); }}
        onConfirm={handleConfirmFuture}
        isSubmitting={setFutureDealMutation.isPending}
      />

      {selectedDeal && (
        <TransactionDetailPanel
          transaction={selectedDeal.transaction}
          stage={selectedDeal.stage}
          clientName={getName(selectedDeal.transaction.client_id)}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </>
  );
}
