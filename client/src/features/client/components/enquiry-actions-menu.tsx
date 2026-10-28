import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckSquare, ChevronDown, Ellipsis, Pencil, Pin, PinOff, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormDrawer } from "@/components/shared/form-drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser, usePackageTypes, useUsers } from "@/hooks/queries";
import { useCreateQuote, useUpdateEnquiry, useDeleteEnquiry } from "@/hooks/mutations";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { buildQuotePayload } from "@/features/quote/components/quote-create-dialog";
import { QuoteRHFForm } from "@/features/quote/components/quote-rhf-form";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { EnquiryWizard } from "@/features/enquiry/components/enquiry-wizard";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import { enquiryApi } from "@/features/enquiry/api/enquiry.api";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import type { EnquiryTable, CreateQuoteData, QuoteFormValues } from "@/features/quote/types";
import { useClientTicketCreate, useControllableOpen } from "@/features/client/components/hooks";
import { HEADER_ELLIPSIS_BUTTON_CLASS } from "@/features/client/components/holiday-header-classes";

type EnquiryUpdateData = Parameters<typeof enquiryApi.update>[1];

/** Items of the enquiry "···" menu that a caller can hide via `hideItems`. */
export type EnquiryMenuItem = "pin" | "edit" | "convert" | "ticket" | "task" | "delete";

// ─── Enquiry actions menu ───────────────────────────────────────────────────
// Mirrors the standalone enquiry page's "···" ellipsis menu: Pin, Edit, and
// (when not already converted) Convert to Quote, plus (Admin only) Delete Enquiry
// — a soft delete behind a confirm dialog.
// `trigger="icon"` renders the same "···" ellipsis button used by the client
// page's header actions cluster.

export function EnquiryActionsMenu({
  enquiryId,
  clientId,
  clientName,
  enquiry,
  destinationName,
  onDeleted,
  trigger = "button",
  hideItems,
  editOpen,
  onEditOpenChange,
  convertOpen,
  onConvertOpenChange,
  ticketOpen,
  onTicketOpenChange,
}: {
  enquiryId: string;
  clientId: string;
  clientName: string;
  enquiry: EnquiryTable;
  destinationName: string | null;
  /** Called after a successful delete so the page can clear its selection. */
  onDeleted: () => void;
  trigger?: "button" | "icon";
  /** Menu items to leave out. */
  hideItems?: ReadonlyArray<EnquiryMenuItem>;
  /** Optional controlled dialog state, so the page can open a dialog this menu owns. */
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  convertOpen?: boolean;
  onConvertOpenChange?: (open: boolean) => void;
  ticketOpen?: boolean;
  onTicketOpenChange?: (open: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { role } = useRole();
  const isAdmin = role === "Admin";
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: usersData } = useUsers();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createQuoteMutation = useCreateQuote();
  const { data: packageTypesData } = usePackageTypes();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditWizard, setShowEditWizard] = useControllableOpen(editOpen, onEditOpenChange);
  const [showConvertModal, setShowConvertModal] = useControllableOpen(convertOpen, onConvertOpenChange);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id, {
    transactionId: enquiry.transaction_id ?? null,
  }, () => onTicketOpenChange?.(false));
  const showTicketDialog = ticketOpen ?? ticketCreate.showTicketDialog;
  const setShowTicketDialog = (next: boolean) => {
    ticketCreate.setShowTicketDialog(next);
    onTicketOpenChange?.(next);
  };
  const hidden = (item: EnquiryMenuItem) => hideItems?.includes(item) ?? false;

  const isEnquiryPinned = useMemo(
    () => userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enquiryId) ?? false,
    [userFavorites, enquiryId],
  );

  const isLost = enquiry.status === "LOST";
  // Once an enquiry is converted, its transaction has moved past on_enquiry
  // (to on_quote, and possibly on_booking from there) — applyLost's
  // on_enquiry branch (server/v2/modules/transaction/transaction.repository.ts)
  // no longer applies to it, and confirming Lost here would silently flip
  // whatever quote/booking the transaction now holds instead, while toasting
  // "Enquiry marked as lost". Hide the action entirely once converted.
  const isConverted = enquiry.status === "Converted";

  const convertDefaultValues = useMemo<Partial<QuoteFormValues>>(
    () => buildQuoteInitialValuesFromEnquiry(enquiry),
    [enquiry],
  );

  // The wizard submits relation ids (destinations: string[], …) where EnquiryTable
  // carries joined objects, so the payload is re-typed to what the update API takes.
  const handleEditSubmit = (data: Partial<EnquiryTable>) => {
    updateEnquiryMutation.mutate(
      { id: enquiryId, data: data as unknown as EnquiryUpdateData },
      {
        onSuccess: () => {
          setShowEditWizard(false);
          toast({ title: "Enquiry updated" });
        },
        onError: () => toast({ title: "Failed to update enquiry", variant: "destructive" }),
      },
    );
  };

  const handleConfirmDelete = () => {
    deleteEnquiryMutation.mutate(enquiryId, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        toast({ title: "Enquiry deleted" });
        onDeleted();
      },
      onError: () => toast({ title: "Failed to delete enquiry", variant: "destructive" }),
    });
  };

  const handleConvertSubmit = (values: QuoteFormValues, images?: { files: File[]; urls: string[] }) => {
    if (!enquiry.transaction_id) {
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }

    const quotePayload = buildQuotePayload(values, packageTypesData);
    const imageUrls = images?.urls || [];
    const convertPayload: CreateQuoteData = {
      ...quotePayload,
      transaction_id: enquiry.transaction_id,
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
    } as CreateQuoteData;

    createQuoteMutation.mutate(convertPayload, {
      onSuccess: (newQuote: { id: string }) => {
        updateEnquiryMutation.mutate({ id: enquiryId, data: { status: "Converted" } });
        setShowConvertModal(false);
        toast({ title: "Enquiry converted to quote!" });
        // Converting drops the enquiry out of the holidays list immediately
        // (the transactions API stops returning `enquiry` once it leaves
        // on_enquiry) — land on the new quote, selected in the client
        // dashboard's deal view, instead of the old standalone quote page.
        navigate(
          clientId ? `/clients/${clientId}?holiday=quote:${newQuote.id}` : `/quotes/${newQuote.id}`,
        );
      },
      onError: () => toast({ title: "Failed to convert enquiry to quote", variant: "destructive" }),
    });
  };

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
          <DropdownMenuItem
            onClick={() =>
              toggleFavoriteMutation.mutate(
                {
                  itemType: "enquiry",
                  itemId: enquiryId,
                  label: enquiry.title || "Enquiry",
                  subtitle: `${clientName || ""}${destinationName ? " · " + destinationName : ""}`,
                },
                {
                  onSuccess: (data: { favorited?: boolean }) =>
                    toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }),
                },
              )
            }
            className="gap-2 rounded-lg text-sm"
          >
            {isEnquiryPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isEnquiryPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          )}
          {!hidden("edit") && (
            <DropdownMenuItem onClick={() => setShowEditWizard(true)} className="gap-2 rounded-lg text-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit Enquiry
            </DropdownMenuItem>
          )}
          {!hidden("convert") && !isConverted && !isLost && (
            <DropdownMenuItem onClick={() => setShowConvertModal(true)} className="gap-2 rounded-lg text-sm">
              <ArrowRight className="h-3.5 w-3.5" /> Convert to Quote
            </DropdownMenuItem>
          )}
          {!hidden("ticket") && (
            <DropdownMenuItem onClick={() => setShowTicketDialog(true)} className="gap-2 rounded-lg text-sm">
              <TicketIcon className="h-3.5 w-3.5" /> Create Ticket
            </DropdownMenuItem>
          )}
          {!hidden("task") && (
            <DropdownMenuItem onClick={() => setShowAddTaskDialog(true)} className="gap-2 rounded-lg text-sm">
              <CheckSquare className="h-3.5 w-3.5" /> Create Task
            </DropdownMenuItem>
          )}
          {isAdmin && !hidden("delete") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600"
                data-testid="button-enquiry-delete"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Enquiry
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              The enquiry will be removed from the client&apos;s holidays and the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEnquiryMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteEnquiryMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="button-enquiry-delete-confirm"
            >
              {deleteEnquiryMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Delete Enquiry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnquiryWizard
        presentation="drawer"
        open={showEditWizard}
        onOpenChange={setShowEditWizard}
        enquiry={enquiry}
        onSubmit={handleEditSubmit}
        isSaving={updateEnquiryMutation.isPending}
      />

      <FormDrawer
        open={showConvertModal}
        onOpenChange={setShowConvertModal}
        title="Convert Enquiry to Quote"
        description="Review and adjust the details from the enquiry, then create the quote."
        data-testid="convert-enquiry-drawer"
      >
        <QuoteRHFForm
          key={enquiryId + showConvertModal}
          layout="drawer"
          defaultValues={convertDefaultValues}
          onSubmit={handleConvertSubmit}
          isLoading={createQuoteMutation.isPending}
          submitLabel="Convert to Quote"
        />
      </FormDrawer>

      <AddTaskModal
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        entityType="enquiry"
        entityId={enquiryId}
        defaultAssignedToId={enquiry.user_id ?? undefined}
      />

      <CreateTicketDialog
        presentation="drawer"
        open={showTicketDialog}
        onOpenChange={setShowTicketDialog}
        clientName={clientName || enquiry.title || "this client"}
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
