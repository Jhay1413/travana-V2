import { useMemo, useState } from "react";
import { useLocation, useRoute, Redirect } from "wouter";
import { ChevronLeft, ChevronDown, Link as LinkIcon, Pin, PinOff, Share2, Sparkles, Star } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuote, useClient, useUsers, quoteKeys, bookingKeys, transactionKeys } from "@/hooks/queries";
import { useUpdateTransaction, useSetPrimaryQuote } from "@/hooks/mutations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { useClientTicketCreate } from "@/features/client/components/hooks";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { transformQuoteData, currency, formatUKDate } from "@/features/quote/components/quote-types";
import { QuoteNotesSection } from "@/features/quote/components/QuoteNotesSection";
import { QuoteTasksSection } from "@/features/quote/components/QuoteTasksSection";
import { StatusPill } from "@/features/quote/components/StatusPill";
import { QuoteEngagement } from "@/features/quote/components/QuoteEngagement";
import { QuoteBookingReferences } from "@/features/quote/components/QuoteBookingReferences";
import { QuoteCostingsCard } from "@/features/quote/components/QuoteCostingsCard";
import { QuoteShareDialog } from "@/features/quote/components/QuoteShareDialog";
import { QuoteConvertDialog } from "@/features/quote/components/QuoteConvertDialog";
import { QuoteDeleteDialog } from "@/features/quote/components/QuoteDeleteDialog";
import { QuoteExpiryDialog } from "@/features/quote/components/QuoteExpiryDialog";
import { QuoteGuruSheet } from "@/features/quote/components/QuoteGuruSheet";
import { QuoteMediaPanel } from "@/features/quote/components/QuoteMediaPanel";
import { QuoteExpiryPill } from "@/features/quote/components/QuoteExpiryPill";
import { QuoteActionsRow } from "@/features/quote/components/QuoteActionsRow";
import { QuoteItinerarySpecs } from "@/features/quote/components/QuoteItinerarySpecs";
import {
  useQuoteImages,
  useQuoteToFormValues,
  useQuoteGuru,
  useQuoteShare,
  useQuoteDelete,
  useQuoteExpiry,
  useQuoteTagEditor,
  useQuoteImageActions,
  useQuoteConvert,
  useQuoteStatusUpdate,
  useQuotePin,
} from "@/features/quote/components/hooks";

export default function QuotePage() {
  const [, setLocation] = useLocation();
  const [, quoteParams] = useRoute("/clients/:clientId/quotes/:quoteId");
  const [, freeQuoteParams] = useRoute("/quotes/:quoteId");
  const params = quoteParams ?? freeQuoteParams;

  const { role } = useRole();
  const clientId = quoteParams?.clientId ?? "";
  const quoteId = params?.quoteId ?? "";

  const quoteQuery = useQuote(quoteId);
  const { data: quoteData, isLoading, error } = quoteQuery;
  const clientQuery = useClient(clientId);
  const clientData = clientQuery.data;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const updateTransactionMutation = useUpdateTransaction();
  const setPrimaryQuoteMutation = useSetPrimaryQuote();
  const handleSetAsMainQuote = () => {
    if (setPrimaryQuoteMutation.isPending) return;
    setPrimaryQuoteMutation.mutate(quoteId, {
      onSuccess: () => {
        toast({ title: "Set as main quote", description: "This quote is now the main quote." });
        queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      },
      onError: (err: any) => {
        toast({
          title: "Couldn't set as main quote",
          description: err?.response?.data?.message || err?.message || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };
  const {
    showSharePopup, setShowSharePopup,
    shareToken, shareCopied, shareLoading,
    openShare, copyShareLink,
  } = useQuoteShare(quoteId);
  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteQuoteMutation, openDeleteDialog, confirmDelete,
  } = useQuoteDelete(quoteId, clientId, "Quote");
  const {
    showExpiryDialog, setShowExpiryDialog,
    expiryDate, setExpiryDate,
    updateQuoteExpiryMutation, openExpiryDialog, confirmExpiry,
  } = useQuoteExpiry(quoteId);
  const {
    showConvertDialog, setShowConvertDialog,
    convertHaysRef, setConvertHaysRef,
    convertTourRef, setConvertTourRef,
    convertToBookingMutation, confirmConvert,
  } = useQuoteConvert(quoteId, clientId);
  const { onStatusChange } = useQuoteStatusUpdate(quoteId);
  const {
    imageInputRef,
    uploadImagesMutation,
    setPrimary: setPrimaryImage,
    removeImage: deleteImage,
    uploadFiles: uploadImageFiles,
    openFilePicker: openImageFilePicker,
    reorderImages: reorderImageOrder,
    reorderImagesMutation,
  } = useQuoteImageActions(quoteId);

  const { primaryImage, galleryImages, quoteImageUrls } = useQuoteImages(quoteData);

  const quote = useMemo(() => {
    if (!quoteData) return null;
    return transformQuoteData(quoteData);
  }, [quoteData]);

  const {
    newTag, setNewTag,
    showTagSuggestions, setShowTagSuggestions,
    tagInputRef, tagSuggestionsRef,
    allTags,
    removeTag, addTag, addTagFromSuggestion,
  } = useQuoteTagEditor(quoteId, quote);

  const {
    showGuruSheet, setShowGuruSheet,
    guruDestination, guruRecord, generateGuruMutation,
  } = useQuoteGuru(quote, quoteData);

  const { isFavorited, togglePin } = useQuotePin(quoteId, {
    label: quote?.quoteTitle ?? "",
    subtitle: `${clientData?.name || ""}${quote?.destinationName ? " · " + quote.destinationName : ""}`,
  });

  const quoteToFormValues = useQuoteToFormValues(quoteData);

  const ticketClientId = clientId || (quoteData as any)?.client_id || "";
  const { data: usersData } = useUsers();
  const ticketCreate = useClientTicketCreate(ticketClientId, currentUser?.id);

  const pageLabel = "Quote";

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-quote">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Quote couldn't be loaded (e.g. deleted or converted) — fall back to the
  // user's home page instead of showing a dead-end error screen. "/" redirects
  // to the role-based home path (see App.tsx).
  if (error || !quote) {
    return <Redirect to="/" />;
  }

  return (
    <>
      <div className="px-5 " data-testid="page-quote">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-quote-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => {
                // On the /quotes/:quoteId route clientId is empty, so fall back to
                // the loaded quote's client_id to return to the client's quotes.
                const backClientId = clientId || (quoteData as any)?.client_id || "";
                setLocation(backClientId ? `/clients/${backClientId}?tab=quotes` : "/");
              }}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Quotes
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid content-start gap-1.5" data-testid="col-itinerary-media">
                  <QuoteMediaPanel
                    primaryImage={primaryImage}
                    galleryImages={galleryImages}
                    imageInputRef={imageInputRef}
                    isUploading={uploadImagesMutation.isPending}
                    setPrimary={setPrimaryImage}
                    deleteImage={deleteImage}
                    uploadFiles={uploadImageFiles}
                    openFilePicker={openImageFilePicker}
                    reorderImages={reorderImageOrder}
                    isReordering={reorderImagesMutation.isPending}
                  />

                </div>

                <div className="min-w-0" data-testid="section-itinerary-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-itinerary-top">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3" data-testid="row-itinerary-title">
                        <div className="min-w-0" data-testid="col-itinerary-title-left">
                          {/* <div className="flex items-center gap-2" data-testid="text-itinerary-quote-title">
                            <span className="truncate text-sm font-semibold md:text-base">{quote.quoteTitle},</span>
                            <span className="flex items-center gap-1.5 font-semibold text-xs text-[#000000] md:text-[14px]" data-testid="text-itinerary-quote-summary">
                              <span>{(() => {
                                const start = new Date(quote.travelDate);
                                const end = new Date(quote.returnDate);
                                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                return `${nights} nights`;
                              })()}</span>
                              <span className="text-black/25">•</span>
                              <span>{currency.format(quote.commissions.price)} <span className="text-black/55">({currency.format(quote.pricePerPerson)}pp)</span></span>
                              {quoteData?.quote_ref && (
                                <a
                                  href={quoteData.quote_ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-px text-[9px] font-semibold text-blue-600 transition hover:bg-blue-500/20"
                                  data-testid="link-view-supplier-link"
                                >
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  View Link
                                </a>
                              )}
                            </span>
                          </div> */}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold" data-testid="text-quote-title">
                                {quote.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(quote.commissions.price)}</span>
                                <span className="text-xs font-medium text-black/55"> ({currency.format(quote.pricePerPerson)}pp)</span>
                              </div>
                              {quote.isCopyQuote && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-500/20 focus:outline-none"
                                      data-testid="pill-quote-copy"
                                    >
                                      Copy Quote
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-44 rounded-xl">
                                    <DropdownMenuItem
                                      onClick={handleSetAsMainQuote}
                                      disabled={setPrimaryQuoteMutation.isPending}
                                      data-testid="button-set-as-main-quote"
                                    >
                                      <Star className="mr-2 h-4 w-4" />
                                      Set as main quote
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-quote-meta">
                              <span data-testid="text-quote-meta-destination">
                                {quote.destinationName || quote.destination}
                                {quote.countryName ? `, ${quote.countryName}` : ""}
                              </span>
                              <span className="text-black/25">•</span>
                              <span data-testid="text-quote-meta-dates">
                                {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                              </span>
                              <span className="text-black/25">•</span>
                              <span data-testid="text-quote-meta-created">Created {formatUKDate(quote.createdAt)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="row-itinerary-status">
                              <StatusPill status={quote.status} onStatusChange={onStatusChange} />
                              <QuoteExpiryPill
                                dateExpiry={(quoteData as any)?.date_expiry}
                                dateCreated={(quoteData as any)?.date_created}
                                onUpdateExpiry={openExpiryDialog}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2" data-testid="col-itinerary-status">
                          <div className="flex flex-nowrap items-center gap-2">
                            <UserReassignSelect
                            value={(quoteData as any)?.user_id || currentUser?.id || ""}
                            onValueChange={(userId) => {
                              updateTransactionMutation.mutate(
                                { id: quote.transaction_id, data: { user_id: userId } },
                                {
                                  onSuccess: () => {
                                    toast({ title: "Transaction reassigned successfully" });
                                    queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
                                    queryClient.invalidateQueries({ queryKey: bookingKeys.detail(quoteId) });
                                  },
                                  onError: () => {
                                    toast({ title: "Failed to reassign transaction", variant: "destructive" });
                                  },
                                }
                              );
                            }}
                            data-testid="select-itinerary-owner"
                          />

                          <QuoteActionsRow
                            pageLabel={pageLabel}
                            canConvert={quote.status !== "accepted"}
                            isAdmin={role === "Admin"}
                            onEdit={() => setShowEditDialog(true)}
                            onConvert={() => setShowConvertDialog(true)}
                            onDuplicate={() => setShowCopyDialog(true)}
                            onExport={() => { }}
                            onTicket={() => ticketCreate.setShowTicketDialog(true)}
                            onAddTask={() => setShowAddTaskDialog(true)}
                            onDelete={openDeleteDialog}
                          />
                          </div>
                          <TooltipProvider>
                          <div className="flex flex-wrap items-center justify-start gap-2 self-start" data-testid="row-itinerary-actions">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={togglePin}
                                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isFavorited
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                                    : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"
                                  }`}
                                data-testid="button-pin-quote"
                                aria-label={isFavorited ? "Unpin" : "Pin"}
                              >
                                {isFavorited ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{isFavorited ? "Unpin" : "Pin"}</TooltipContent>
                          </Tooltip>

                          {quoteData?.quote_ref && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={quoteData.quote_ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                                  data-testid="link-view-quote"
                                  aria-label="View Quote"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>View Quote</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={openShare}
                                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                                data-testid="button-share-quote"
                                aria-label="Share Quote"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Share Quote</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                className="h-9 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm"
                                data-testid="button-destination-guru"
                                onClick={() => setShowGuruSheet(true)}
                                aria-label="Destination Guru"
                              >
                                <Sparkles className="xl:mr-2 h-4 w-4" />

                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Destination Guru</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        {quote.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2" data-testid="list-itinerary-tags-inline">
                            {quote.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-black/70"
                                data-testid={`pill-itinerary-tag-${t}`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <QuoteItinerarySpecs quote={quote} quoteData={quoteData} />

                  <QuoteBookingReferences quote={quote} />

                  <div className="mt-3 grid items-stretch gap-3 md:grid-cols-2" data-testid="grid-quote-engagement-tasks">
                    <QuoteEngagement quoteId={quoteId} className="h-full" />
                    <QuoteTasksSection
                      quoteId={quoteId}
                      entityType="quote"
                      assignedUserId={(quoteData as any)?.user_id}
                      addOpen={showAddTaskDialog}
                      onAddOpenChange={setShowAddTaskDialog}
                      hideAddButton
                      className="h-full"
                    />
                  </div>

                  <QuoteNotesSection transactionId={quote.transaction_id} />


                </div>
              </div>
            </Card>

            <div className="grid gap-3 text-sm xl:text-base" data-testid="col-quote-right">
              <QuoteCostingsCard quote={quote} pageLabel={pageLabel} />
            </div>
          </div>
        </div>
      </div>
      <QuoteEditDialog
        quoteId={quoteId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["quotes"] })}
      />
      {quoteData && (
        <QuoteCreateDialog
          transactionId={quoteData.transaction_id}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}
      {quoteData && (
        <QuoteCreateDialog
          transactionId={quoteData.transaction_id}
          clientId={clientId}
          userId={currentUser?.id}
          open={showCopyDialog}
          onOpenChange={setShowCopyDialog}
          markAsCopy
          duplicateFromQuoteId={quoteData.id}
          // Package commission carries over — it's a property of the package, not
          // of the individual sale. Discount and service charge are per-sale
          // concessions, so they reset and get re-entered deliberately.
          // pricePerPerson is cleared so the server recalculates it from the new
          // figures instead of keeping the source's now-stale per-person price.
          initialValues={{ ...quoteToFormValues, discount: 0, serviceCharge: 0, pricePerPerson: 0 }}
          initialImages={quoteImageUrls}
          onSuccess={(newQuoteId) => {
            setShowCopyDialog(false);
            queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
            queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            toast({ title: "Quote copied successfully" });
            setLocation(clientId ? `/clients/${clientId}/quotes/${newQuoteId}` : `/quotes/${newQuoteId}`);
          }}
        />
      )}
      <QuoteShareDialog
        open={showSharePopup}
        onOpenChange={setShowSharePopup}
        shareToken={shareToken}
        shareCopied={shareCopied}
        shareLoading={shareLoading}
        onCopy={copyShareLink}
        clientId={clientId || undefined}
      />

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
        pageLabel={pageLabel}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isPending={adminDeleteQuoteMutation.isPending}
        onConfirm={confirmDelete}
      />

      <QuoteExpiryDialog
        open={showExpiryDialog}
        onOpenChange={setShowExpiryDialog}
        expiryDate={expiryDate}
        onExpiryDateChange={setExpiryDate}
        isPending={updateQuoteExpiryMutation.isPending}
        onConfirm={confirmExpiry}
      />

      <QuoteGuruSheet
        open={showGuruSheet}
        onOpenChange={setShowGuruSheet}
        guruDestination={guruDestination}
        guruRecord={guruRecord as any}
        generateGuruMutation={generateGuruMutation}
      />

      <CreateTicketDialog
        open={ticketCreate.showTicketDialog}
        onOpenChange={ticketCreate.setShowTicketDialog}
        clientName={clientData?.name || quote.quoteTitle || "this client"}
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

