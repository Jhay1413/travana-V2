import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Ban, CalendarClock, CheckSquare, ChevronDown, Copy, Ellipsis, Pencil, RefreshCw, RotateCcw, Star, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser, useUsers, quoteKeys } from "@/hooks/queries";
import { useSetDealLost } from "@/hooks/mutations";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { type QuoteDisplay } from "@/features/quote/components/quote-types";
import type { EnrichedQuote } from "@/features/quote/types";
import { useQuoteConvert, useQuoteDelete, useQuoteToFormValues } from "@/features/quote/components/hooks";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { QuoteConvertDialog } from "@/features/quote/components/QuoteConvertDialog";
import { QuoteDeleteDialog } from "@/features/quote/components/QuoteDeleteDialog";
import { CreateTaskDialog } from "@/features/tasks/components/tasks/CreateTaskDialog";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { useClientTicketCreate, useControllableOpen, useSetAsMainQuote } from "@/features/client/components/hooks";
import { HEADER_ELLIPSIS_BUTTON_CLASS } from "@/features/client/components/holiday-header-classes";

/** Items of the quote "···" menu that a caller can hide via `hideItems`. */
export type QuoteMenuItem = "edit" | "convert" | "duplicate" | "expiry" | "ticket" | "task" | "setPrimary" | "lost" | "delete";

// ─── Quote actions menu ─────────────────────────────────────────────────────
// Mirrors the standalone quote page's QuoteActionsRow. "Export" is left out —
// it's a no-op on the standalone page too (onExport={() => {}}), so there's
// nothing real to wire. `trigger="icon"` renders the "···" ellipsis button used
// by the client page's header actions cluster instead of the outline "Actions"
// button used in the hero card.

export function QuoteActionsMenu({
  quoteId,
  quoteData,
  quote,
  quoteImageUrls,
  clientId,
  clientName,
  onDeleted,
  onOpenExpiryDialog,
  trigger = "button",
  showSetPrimary = false,
  hideItems,
  copySuccessToast = "Quote copied successfully",
  editOpen,
  onEditOpenChange,
  copyOpen,
  onCopyOpenChange,
  addTaskOpen,
  onAddTaskOpenChange,
  ticketOpen,
  onTicketOpenChange,
}: {
  quoteId: string;
  quoteData: EnrichedQuote | undefined;
  quote: QuoteDisplay;
  quoteImageUrls: string[];
  clientId: string;
  clientName: string;
  onDeleted: () => void;
  /** Opens the single, shared "Update Expiry" dialog owned by the page (see
   *  pages/client/index.tsx) — keeps exactly one <QuoteExpiryDialog> mounted
   *  even though both this menu and the hero card's banner can trigger it. */
  onOpenExpiryDialog: (dateExpiry: string | Date | null | undefined) => void;
  trigger?: "button" | "icon";
  /** Adds a "Set as main quote" item (for copy quotes). Off by default. */
  showSetPrimary?: boolean;
  /** Menu items to leave out (e.g. the redesigned page shows Duplicate / Convert as header buttons). */
  hideItems?: ReadonlyArray<QuoteMenuItem>;
  /** Toast title shown after a successful duplicate. */
  copySuccessToast?: string;
  /** Optional controlled dialog state, so the page can open a dialog this menu owns. */
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  copyOpen?: boolean;
  onCopyOpenChange?: (open: boolean) => void;
  addTaskOpen?: boolean;
  onAddTaskOpenChange?: (open: boolean) => void;
  ticketOpen?: boolean;
  onTicketOpenChange?: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const { role } = useRole();
  const isAdmin = role === "Admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: usersData } = useUsers();

  const [showEditDialog, setShowEditDialog] = useControllableOpen(editOpen, onEditOpenChange);
  const [showCopyDialog, setShowCopyDialog] = useControllableOpen(copyOpen, onCopyOpenChange);
  const [showAddTaskDialog, setShowAddTaskDialog] = useControllableOpen(addTaskOpen, onAddTaskOpenChange);
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const { setAsMainQuote, isPending: setPrimaryPending } = useSetAsMainQuote(quoteId);
  const hidden = (item: QuoteMenuItem) => hideItems?.includes(item) ?? false;

  const {
    showConvertDialog, setShowConvertDialog,
    convertHaysRef, setConvertHaysRef,
    convertTourRef, setConvertTourRef,
    convertToBookingMutation, confirmConvert,
  } = useQuoteConvert(quoteId, clientId);

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteQuoteMutation, openDeleteDialog, confirmDelete,
    siblings: deleteSiblings, newPrimaryQuoteId, setNewPrimaryQuoteId,
  } = useQuoteDelete(quoteId, clientId, "Quote", {
    transactionId: quoteData?.transaction_id,
    isPrimary: quoteData?.isQuoteCopy === false,
  });

  const setDealLostMutation = useSetDealLost();
  const isLost = quote.status === "lost";
  // "accepted" isn't a real quote_status value (enum is quoted/in_play/lost/
  // archived) — this mirrors the same (largely vestigial) guard the "Convert
  // to Booking" item already used, so both items stay consistent. It won't
  // catch every case where the deal has since become a booking (the quote
  // row has no direct signal for that), so handleConfirmMarkLost also
  // surfaces the server's specific 400 for that case below.
  const isBookedLikely = quote.status === "accepted";

  function handleConfirmMarkLost() {
    if (!quoteData?.transaction_id) return;
    setDealLostMutation.mutate(
      { id: quoteData.transaction_id, lost: true },
      {
        onSuccess: () => {
          setShowLostConfirm(false);
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
          toast({ title: "Quote marked as lost" });
        },
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 400) {
            toast({
              title: "Can't mark this deal as lost",
              description: "This deal has already been converted to a booking.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Failed to mark quote as lost", variant: "destructive" });
          }
        },
      },
    );
  }

  function handleReopen() {
    if (!quoteData?.transaction_id) return;
    setDealLostMutation.mutate(
      { id: quoteData.transaction_id, lost: false },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
          toast({ title: "Quote reopened" });
        },
        onError: () => toast({ title: "Failed to reopen quote", variant: "destructive" }),
      },
    );
  }

  const quoteToFormValues = useQuoteToFormValues(quoteData);
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id, { transactionId: quoteData?.transaction_id ?? null }, () => onTicketOpenChange?.(false));
  const showTicketDialog = ticketOpen ?? ticketCreate.showTicketDialog;
  const setShowTicketDialog = (next: boolean) => {
    ticketCreate.setShowTicketDialog(next);
    onTicketOpenChange?.(next);
  };

  // useQuoteDelete already navigates away on success — the dashboard's
  // selection state is separate, so it also needs clearing here or the center
  // column stays pointed at the now-deleted quote.
  useEffect(() => {
    if (adminDeleteQuoteMutation.isSuccess) onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminDeleteQuoteMutation.isSuccess]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger === "icon" ? (
            <button
              type="button"
              className={HEADER_ELLIPSIS_BUTTON_CLASS}
              aria-label="More actions"
              data-testid="client-header-actions"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-md border-black/10 bg-white"
              data-testid="holiday-detail-actions"
            >
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          {!hidden("edit") && (
            <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="gap-2 rounded-lg text-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit Quote
            </DropdownMenuItem>
          )}
          {!hidden("convert") && !isBookedLikely && !isLost && (
            <DropdownMenuItem onClick={() => setShowConvertDialog(true)} className="gap-2 rounded-lg text-sm">
              <RefreshCw className="h-3.5 w-3.5" /> Convert to Booking
            </DropdownMenuItem>
          )}
          {!hidden("duplicate") && (
            <DropdownMenuItem onClick={() => setShowCopyDialog(true)} className="gap-2 rounded-lg text-sm">
              <Copy className="h-3.5 w-3.5" /> Duplicate Quote
            </DropdownMenuItem>
          )}
          {!hidden("expiry") && (
            <DropdownMenuItem
              onClick={() => onOpenExpiryDialog(quoteData?.date_expiry)}
              className="gap-2 rounded-lg text-sm"
            >
              <CalendarClock className="h-3.5 w-3.5" /> Update Expiry
            </DropdownMenuItem>
          )}
          {!hidden("ticket") && (
            <DropdownMenuItem onClick={() => setShowTicketDialog(true)} className="gap-2 rounded-lg text-sm">
              <TicketIcon className="h-3.5 w-3.5" /> Ticket
            </DropdownMenuItem>
          )}
          {!hidden("task") && (
            <DropdownMenuItem onClick={() => setShowAddTaskDialog(true)} className="gap-2 rounded-lg text-sm">
              <CheckSquare className="h-3.5 w-3.5" /> Add Task
            </DropdownMenuItem>
          )}
          {showSetPrimary && !hidden("setPrimary") && (
            <DropdownMenuItem
              onClick={setAsMainQuote}
              disabled={setPrimaryPending}
              className="gap-2 rounded-lg text-sm"
              data-testid="button-holiday-set-as-main-quote"
            >
              <Star className="h-3.5 w-3.5" /> Set as main quote
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {!hidden("lost") && (isLost ? (
            <DropdownMenuItem onClick={handleReopen} className="gap-2 rounded-lg text-sm">
              <RotateCcw className="h-3.5 w-3.5" /> Reopen Quote
            </DropdownMenuItem>
          ) : (
            !isBookedLikely && (
              <DropdownMenuItem onClick={() => setShowLostConfirm(true)} className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600">
                <Ban className="h-3.5 w-3.5" /> Mark as Lost
              </DropdownMenuItem>
            )
          ))}
          {isAdmin && !hidden("delete") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openDeleteDialog} className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete Quote
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <QuoteEditDialog
        presentation="drawer"
        quoteId={quoteId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["quotes"] })}
      />

      {quoteData && (
        <QuoteCreateDialog
          presentation="drawer"
          transactionId={quoteData.transaction_id}
          clientId={clientId}
          userId={currentUser?.id}
          open={showCopyDialog}
          onOpenChange={setShowCopyDialog}
          markAsCopy
          duplicateFromQuoteId={quoteData.id}
          initialValues={{ ...quoteToFormValues, discount: 0, serviceCharge: 0, pricePerPerson: 0 }}
          initialImages={quoteImageUrls}
          onSuccess={(newQuoteId) => {
            setShowCopyDialog(false);
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            toast({ title: copySuccessToast });
            setLocation(
              clientId ? `/clients/${clientId}?holiday=quote:${newQuoteId}` : `/quotes/${newQuoteId}`,
            );
          }}
        />
      )}

      <QuoteConvertDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        haysRef={convertHaysRef}
        onHaysRefChange={setConvertHaysRef}
        tourRef={convertTourRef}
        onTourRefChange={setConvertTourRef}
        isPending={convertToBookingMutation.isPending}
        onConfirm={confirmConvert}
      />

      <QuoteDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        pageLabel="Quote"
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isPending={adminDeleteQuoteMutation.isPending}
        onConfirm={confirmDelete}
        siblings={deleteSiblings}
        newPrimaryQuoteId={newPrimaryQuoteId}
        onNewPrimaryQuoteIdChange={setNewPrimaryQuoteId}
      />

      <AlertDialog open={showLostConfirm} onOpenChange={setShowLostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this quote as lost?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the deal into the pipeline&apos;s Lost column. You can reopen it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setDealLostMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmMarkLost();
              }}
              disabled={setDealLostMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {setDealLostMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateTaskDialog
        presentation="drawer"
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        entityType="quote"
        entityId={quoteId}
        defaultAssignedToId={quoteData?.user_id}
      />

      <CreateTicketDialog
        presentation="drawer"
        open={showTicketDialog}
        onOpenChange={setShowTicketDialog}
        clientName={clientName || quote.quoteTitle || "this client"}
        ticketForm={ticketCreate.ticketForm}
        setTicketForm={ticketCreate.setTicketForm}
        ticketPendingFiles={ticketCreate.ticketPendingFiles}
        ticketFileInputRef={ticketCreate.ticketFileInputRef}
        isUploading={ticketCreate.isTicketUploading}
        isPending={ticketCreate.createTicketMutation.isPending}
        users={usersData ?? []}
        onFileSelect={ticketCreate.handleTicketFileSelect}
        removePendingFile={ticketCreate.removeTicketPendingFile}
        formatFileSize={ticketCreate.formatTicketFileSize}
        onConfirm={ticketCreate.handleCreateTicket}
        onReset={ticketCreate.resetTicketForm}
      />
    </>
  );
}
