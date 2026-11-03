import { useEffect } from "react";
import { ChevronDown, Ellipsis, PackagePlus, Pencil, Pin, PinOff, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser, useUsers } from "@/hooks/queries";
import { useRole } from "@/hooks/use-role";
import { type QuoteDisplay } from "@/features/quote/components/quote-types";
import { QuoteDeleteDialog } from "@/features/quote/components/QuoteDeleteDialog";
import { useBookingPin, useBookingDelete } from "@/features/booking/components/hooks";
import { BookingEditDialog } from "@/features/booking/components/booking-edit-dialog";
import { BookingUpsellsDialog } from "@/features/booking/components/BookingUpsellsDialog";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { useClientTicketCreate, useControllableOpen } from "@/features/client/components/hooks";
import { HEADER_ELLIPSIS_BUTTON_CLASS } from "@/features/client/components/holiday-header-classes";

/** Items of the booking "···" menu that a caller can hide via `hideItems`. */
export type BookingMenuItem = "pin" | "edit" | "upsells" | "ticket" | "delete";

// ─── Booking actions menu ───────────────────────────────────────────────────
// Mirrors the standalone booking page's "···" ellipsis menu: Pin, Edit,
// Manage Upsells, and (Admin only) Delete. `trigger="icon"` renders the same
// "···" ellipsis button used by the client page's header actions cluster.

export function BookingActionsMenu({
  bookingId,
  clientId,
  clientName,
  booking,
  onDeleted,
  trigger = "button",
  hideItems,
  editOpen,
  onEditOpenChange,
  upsellsOpen,
  onUpsellsOpenChange,
  ticketOpen,
  onTicketOpenChange,
}: {
  bookingId: string;
  clientId: string;
  clientName?: string;
  booking: QuoteDisplay;
  onDeleted: () => void;
  trigger?: "button" | "icon";
  /** Menu items to leave out. */
  hideItems?: ReadonlyArray<BookingMenuItem>;
  /** Optional controlled dialog state, so the page can open a dialog this menu owns. */
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  upsellsOpen?: boolean;
  onUpsellsOpenChange?: (open: boolean) => void;
  ticketOpen?: boolean;
  onTicketOpenChange?: (open: boolean) => void;
}) {
  const { role } = useRole();
  const isAdmin = role === "Admin";
  const { data: currentUser } = useCurrentUser();
  const { data: usersData } = useUsers();
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id, { transactionId: booking.transaction_id ?? null }, () => onTicketOpenChange?.(false));

  const [showEditDialog, setShowEditDialog] = useControllableOpen(editOpen, onEditOpenChange);
  const [showUpsellsDialog, setShowUpsellsDialog] = useControllableOpen(upsellsOpen, onUpsellsOpenChange);
  const showTicketDialog = ticketOpen ?? ticketCreate.showTicketDialog;
  const setShowTicketDialog = (next: boolean) => {
    ticketCreate.setShowTicketDialog(next);
    onTicketOpenChange?.(next);
  };
  const hidden = (item: BookingMenuItem) => hideItems?.includes(item) ?? false;

  const { isFavorited, togglePin } = useBookingPin(bookingId, {
    label: booking.quoteTitle ?? "",
    subtitle: `${booking.destinationName || booking.destination || ""}`,
  });

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteBookingMutation, openDeleteDialog, confirmDelete,
  } = useBookingDelete(bookingId, clientId);

  useEffect(() => {
    if (adminDeleteBookingMutation.isSuccess) onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminDeleteBookingMutation.isSuccess]);

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
          {!hidden("pin") && (
            <DropdownMenuItem onClick={togglePin} className="gap-2 rounded-lg text-sm">
              {isFavorited ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {isFavorited ? "Unpin" : "Pin"}
            </DropdownMenuItem>
          )}
          {!hidden("edit") && (
            <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="gap-2 rounded-lg text-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit Booking
            </DropdownMenuItem>
          )}
          {!hidden("upsells") && (
            <DropdownMenuItem onClick={() => setShowUpsellsDialog(true)} className="gap-2 rounded-lg text-sm">
              <PackagePlus className="h-3.5 w-3.5" /> Manage Upsells
            </DropdownMenuItem>
          )}
          {!hidden("ticket") && (
            <DropdownMenuItem onClick={() => setShowTicketDialog(true)} className="gap-2 rounded-lg text-sm" data-testid="booking-create-ticket">
              <TicketIcon className="h-3.5 w-3.5" /> Create Ticket
            </DropdownMenuItem>
          )}
          {isAdmin && !hidden("delete") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openDeleteDialog} className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete Booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BookingEditDialog
        presentation="drawer"
        bookingId={bookingId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <BookingUpsellsDialog bookingId={bookingId} open={showUpsellsDialog} onOpenChange={setShowUpsellsDialog} />
      <CreateTicketDialog
        presentation="drawer"
        open={showTicketDialog}
        onOpenChange={setShowTicketDialog}
        clientName={clientName || booking.quoteTitle || "this client"}
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
      <QuoteDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        pageLabel="Booking"
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isPending={adminDeleteBookingMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
