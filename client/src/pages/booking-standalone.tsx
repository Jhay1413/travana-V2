import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, LinkIcon, MoreHorizontal, PackagePlus, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useBooking, useNeonClient, bookingKeys } from "@/hooks/queries";
import { useUpdateTransaction } from "@/hooks/mutations";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { transformQuoteData, currency, formatUKDate } from "@/features/quote/components/quote-types";
import { sumUpsells } from "@/features/booking/types";
import { QuoteNotesSection } from "@/features/quote/components/QuoteNotesSection";
import { QuoteTasksSection } from "@/features/quote/components/QuoteTasksSection";
import { BookingEditDialog } from "@/features/booking/components/booking-edit-dialog";
import { BookingUpsellsDialog } from "@/features/booking/components/BookingUpsellsDialog";

import { useQuoteImages } from "@/features/quote/components/hooks";
import { QuoteBookingReferences } from "@/features/quote/components/QuoteBookingReferences";
import { QuoteDeleteDialog } from "@/features/quote/components/QuoteDeleteDialog";
import { QuoteTagsCard } from "@/features/quote/components/QuoteTagsCard";

import { useBookingPin, useBookingDelete, useBookingTagEditor, useBookingImageActions } from "@/features/booking/components/hooks";
import { BookingMediaPanel } from "@/features/booking/components/BookingMediaPanel";
import { BookingItinerarySpecs } from "@/features/booking/components/BookingItinerarySpecs";
import { BookingCostingsCard } from "@/features/booking/components/BookingCostingsCard";

export default function BookingPage() {
  const [, setLocation] = useLocation();
  const [, bookingParams] = useRoute("/clients/:clientId/bookings/:quoteId");
  const [, freeBookingParams] = useRoute("/bookings/:quoteId");
  const params = bookingParams ?? freeBookingParams;

  const { role } = useRole();
  const clientId = bookingParams?.clientId ?? "";
  const bookingId = params?.quoteId ?? "";

  const bookingQuery = useBooking(bookingId);
  const { data: bookingData, isLoading, error } = bookingQuery;
  const neonClientQuery = useNeonClient(clientId);
  const clientData = neonClientQuery.data
    ? { name: `${neonClientQuery.data.firstName || ""} ${neonClientQuery.data.surename || ""}`.trim() }
    : undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUpsellsDialog, setShowUpsellsDialog] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const updateTransactionMutation = useUpdateTransaction();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { primaryImage, galleryImages } = useQuoteImages(bookingData);
  const {
    imageInputRef,
    uploadImagesMutation,
    setPrimary: setPrimaryImage,
    removeImage: deleteImage,
    uploadFiles: uploadImageFiles,
    openFilePicker: openImageFilePicker,
  } = useBookingImageActions(bookingId);

  const booking = useMemo(() => {
    if (!bookingData) return null;
    return transformQuoteData(bookingData);
  }, [bookingData]);

  // Customer-facing total including any post-booking upsells, mirroring the
  // costings card so the header price stays in sync.
  const totalPrice = useMemo(
    () => (booking ? booking.commissions.price + sumUpsells(bookingData?.upsells).price : 0),
    [booking, bookingData],
  );

  const {
    newTag, setNewTag,
    showTagSuggestions, setShowTagSuggestions,
    tagInputRef, tagSuggestionsRef,
    allTags,
    removeTag, addTag, addTagFromSuggestion,
  } = useBookingTagEditor(bookingId, booking);

  const { isFavorited, togglePin } = useBookingPin(bookingId, {
    label: booking?.quoteTitle ?? "",
    subtitle: `${clientData?.name || ""}${booking?.destinationName ? " · " + booking.destinationName : ""}`,
  });

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteBookingMutation, openDeleteDialog, confirmDelete,
  } = useBookingDelete(bookingId, clientId);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-booking">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-booking">
        <div className="text-center">
          <p className="text-sm text-black/70">Failed to load booking</p>
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
      <div className="px-5 " data-testid="page-booking">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-booking-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => setLocation(clientId ? `/clients/${clientId}?tab=booked` : "/")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Bookings
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <UserReassignSelect
              value={(bookingData as any)?.user_id || currentUser?.id || ""}
              onValueChange={(userId) => {
                updateTransactionMutation.mutate(
                  { id: booking.transaction_id, data: { user_id: userId } },
                  {
                    onSuccess: () => {
                      toast({ title: "Transaction reassigned successfully" });
                      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
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
                className="grid h-9 w-9 place-items-center rounded-2xl border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                data-testid="button-booking-ellipsis"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showEllipsisMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-booking-ellipsis">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                    data-testid="button-booking-pin"
                    onClick={() => {
                      setShowEllipsisMenu(false);
                      togglePin();
                    }}
                  >
                    {isFavorited ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {isFavorited ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                    data-testid="button-booking-edit"
                    onClick={() => {
                      setShowEllipsisMenu(false);
                      setShowEditDialog(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Booking
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                    data-testid="button-booking-upsells"
                    onClick={() => {
                      setShowEllipsisMenu(false);
                      setShowUpsellsDialog(true);
                    }}
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    Manage Upsells
                  </button>
                  {role === "Admin" && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
                      data-testid="button-booking-admin-delete"
                      onClick={() => {
                        setShowEllipsisMenu(false);
                        openDeleteDialog();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Booking
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-booking-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_340px]" data-testid="grid-booking-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-booking-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid content-start gap-1.5" data-testid="col-itinerary-media">
                  <BookingMediaPanel
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
                    tags={booking.tags}
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
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold" data-testid="text-booking-title">
                                {booking.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(totalPrice)}</span>
                                <span className="text-xs font-medium text-black/55"> ({currency.format(booking.pricePerPerson)}pp)</span>
                              </div>
                              <span
                                className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                data-testid="pill-booking-status"
                              >
                                Booked
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-booking-meta">
                              <span data-testid="text-booking-meta-destination">{booking.destinationName || booking.destination}</span>
                              <span className="text-black/25">•</span>
                              <span data-testid="text-booking-meta-dates">
                                {formatUKDate(booking.travelDate)} → {formatUKDate(booking.returnDate)}
                              </span>
                              <span className="text-black/25">•</span>
                              <span data-testid="text-booking-meta-created">Created {formatUKDate(booking.createdAt)}</span>
                            </div>
                            {booking.quoteLink && booking.quoteLink !== "#" && (
                              <a
                                href={booking.quoteLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#3b82f6] transition hover:text-[#3b82f6]/80"
                                data-testid="link-booking-link"
                              >
                                <LinkIcon className="h-3 w-3" />
                                View Booking Link
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        {booking.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2" data-testid="list-itinerary-tags-inline">
                            {booking.tags.map((t) => (
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

                  <BookingItinerarySpecs booking={booking} />

                  <QuoteBookingReferences quote={booking} />

                  <QuoteNotesSection transactionId={booking.transaction_id} />

                </div>
              </div>
            </Card>

            <div className="grid gap-3 text-sm xl:text-base" data-testid="col-booking-right">
              <BookingCostingsCard booking={booking} hasReferral={!!bookingData?.hasReferral} upsells={bookingData?.upsells} />

              <QuoteTasksSection quoteId={bookingId} entityType="booking" assignedUserId={(bookingData as any)?.user_id} />

            </div>
          </div>
        </div>
      </div>
      <BookingEditDialog
        bookingId={bookingId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => bookingQuery.refetch()}
      />
      <BookingUpsellsDialog
        bookingId={bookingId}
        open={showUpsellsDialog}
        onOpenChange={setShowUpsellsDialog}
        onSuccess={() => bookingQuery.refetch()}
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
