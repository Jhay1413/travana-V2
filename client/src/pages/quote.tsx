import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, MoreHorizontal, Pencil, RefreshCw, Link as LinkIcon, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuote, useClient, quoteKeys, bookingKeys, transactionKeys } from "@/hooks/queries";
import { useUpdateTransaction } from "@/hooks/mutations";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { QuoteEditDialog } from "@/components/quote/quote-edit-dialog";
import { QuoteCreateDialog } from "@/components/quote/quote-create-dialog";
import { transformQuoteData, currency, formatUKDate } from "@/components/quote/quote-types";
import { QuoteNotesSection } from "@/components/quote/QuoteNotesSection";
import { QuoteTasksSection } from "@/components/quote/QuoteTasksSection";
import { StatusPill } from "@/components/quote/StatusPill";
import { QuoteEngagement } from "@/components/quote/QuoteEngagement";
import { QuoteBookingReferences } from "@/components/quote/QuoteBookingReferences";
import { QuoteCostingsCard } from "@/components/quote/QuoteCostingsCard";
import { QuoteShareDialog } from "@/components/quote/QuoteShareDialog";
import { QuoteConvertDialog } from "@/components/quote/QuoteConvertDialog";
import { QuoteDeleteDialog } from "@/components/quote/QuoteDeleteDialog";
import { QuoteExpiryDialog } from "@/components/quote/QuoteExpiryDialog";
import { QuoteGuruSheet } from "@/components/quote/QuoteGuruSheet";
import { QuoteTagsCard } from "@/components/quote/QuoteTagsCard";
import { QuoteMediaPanel } from "@/components/quote/QuoteMediaPanel";
import { QuoteExpiryPill } from "@/components/quote/QuoteExpiryPill";
import { QuoteActionsRow } from "@/components/quote/QuoteActionsRow";
import { QuoteItinerarySpecs } from "@/components/quote/QuoteItinerarySpecs";
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
} from "@/components/quote/hooks";

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
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const updateTransactionMutation = useUpdateTransaction();
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
  const { onStatusChange } = useQuoteStatusUpdate(quoteId, () => setShowConvertDialog(true));
  const {
    imageInputRef,
    uploadImagesMutation,
    setPrimary: setPrimaryImage,
    removeImage: deleteImage,
    uploadFiles: uploadImageFiles,
    openFilePicker: openImageFilePicker,
  } = useQuoteImageActions(quoteId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const pageLabel = "Quote";

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-quote">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-quote">
        <div className="text-center">
          <p className="text-sm text-black/70">Failed to load {pageLabel.toLowerCase()}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/clients")}
          >
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pb-8 pt-5" data-testid="page-quote">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-quote-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => setLocation(clientId ? `/clients/${clientId}?tab=quotes` : "/")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Quotes
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-quote-title">
                  {quote.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(quote.pricePerPerson)}pp</span>
                </div>
                <StatusPill status={quote.status} onStatusChange={onStatusChange} />
                {quote.isCopyQuote && (
                  <span
                    className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                    data-testid="pill-quote-copy"
                  >
                    Copy Quote
                  </span>
                )}

                <QuoteExpiryPill
                  dateExpiry={(quoteData as any)?.date_expiry}
                  dateCreated={(quoteData as any)?.date_created}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-quote-meta">
                <span data-testid="text-quote-meta-destination">{quote.destinationName || quote.destination}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-dates">
                  {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                </span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-created">Created {formatUKDate(quote.createdAt)}</span>
              </div>
            </div>
          </div>

          <QuoteActionsRow
            dateExpiry={(quoteData as any)?.date_expiry}
            isFavorited={isFavorited}
            onTogglePin={togglePin}
            onUpdateExpiry={openExpiryDialog}
            onShare={openShare}
            onOpenGuru={() => setShowGuruSheet(true)}
            onCopy={() => setShowCopyDialog(true)}
            onExport={() => {}}
          />
        </div>

        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
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
                  />

                  <QuoteTagsCard
                    tags={quote.tags}
                    newTag={newTag}
                    setNewTag={setNewTag}
                    showTagSuggestions={showTagSuggestions}
                    setShowTagSuggestions={setShowTagSuggestions}
                    tagInputRef={tagInputRef}
                    tagSuggestionsRef={tagSuggestionsRef}
                    allTags={allTags}
                    removeTag={removeTag}
                    addTag={addTag}
                    addTagFromSuggestion={addTagFromSuggestion}
                  />

                </div>

                <div className="min-w-0" data-testid="section-itinerary-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-itinerary-top">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3" data-testid="row-itinerary-title">
                        <div className="min-w-0" data-testid="col-itinerary-title-left">
                          <div className="flex items-center gap-2" data-testid="text-itinerary-quote-title">
                            <span className="truncate text-base font-semibold">{quote.quoteTitle},</span>
                            <span className="flex items-center gap-1.5 font-semibold text-[14px] text-[#000000]" data-testid="text-itinerary-quote-summary">
                              <span>{(() => {
                                const start = new Date(quote.travelDate);
                                const end = new Date(quote.returnDate);
                                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                return `${nights} nights`;
                              })()}</span>
                              <span className="text-black/25">•</span>
                              <span>{currency.format(quote.pricePerPerson)}pp</span>
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
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserReassignSelect
                            value={quoteData?.user_id || currentUser?.id || ""}
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

                          <div className="relative" ref={ellipsisRef}>
                            <button
                              type="button"
                              onClick={() => setShowEllipsisMenu((v) => !v)}
                              className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                              data-testid="button-quote-ellipsis"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showEllipsisMenu && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-quote-ellipsis">
                                {[
                                  { label: `Edit ${pageLabel}`, icon: Pencil, id: "edit" },
                                  ...(quote.status !== "accepted" ? [{ label: "Convert to Booking", icon: RefreshCw, id: "convert" }] : []),
                                  { label: `Duplicate ${pageLabel}`, icon: Copy, id: "duplicate" },
                                  ...(role === "Admin" ? [{ label: `Delete ${pageLabel}`, icon: Trash2, id: "admin-delete" }] : []),
                                ].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-black/[0.05] ${item.id === "admin-delete" ? "text-red-600 hover:bg-red-50" : "text-black/75"}`}
                                    data-testid={`button-quote-${item.id}`}
                                    onClick={() => {
                                      setShowEllipsisMenu(false);
                                      if (item.id === "edit") {
                                        setShowEditDialog(true);
                                      } else if (item.id === "convert") {
                                        setShowConvertDialog(true);
                                      } else if (item.id === "admin-delete") {
                                        openDeleteDialog();
                                      } else {
                                        setShowCopyDialog(true);
                                      }
                                    }}
                                  >
                                    <item.icon className="h-3.5 w-3.5" />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        <span className="text-sm text-black/55" data-testid="text-itinerary-location">{quote.destinationName || quote.destination}</span>
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

                  <QuoteNotesSection transactionId={quote.transaction_id} />


                </div>
              </div>
            </Card>

            <div className="grid gap-3" data-testid="col-quote-right">
              <QuoteCostingsCard quote={quote} pageLabel={pageLabel} />

              <QuoteTasksSection quoteId={quoteId} entityType="quote" assignedUserId={quoteData?.user_id} />

              <QuoteEngagement quoteId={quoteId} />

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
          initialValues={quoteToFormValues}
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
    </>
  );
}

