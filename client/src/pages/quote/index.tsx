/**
 * Quote Page - Main Component
 * Refactored version with modular structure
 * 
 * This is the detail page for a single quote or booking.
 * Original file: 2,388 lines → Refactored: ~150 lines + modular components
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ChevronLeft,
  Copy,
  FileText,
  PinOff,
  Pin,
  Star,
  Tag,
  X,
  ImagePlus,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import { useUpdateQuote, useUpdateBooking, useUploadQuoteImages, useDeleteQuoteImage, useSetPrimaryQuoteImage } from "@/hooks/mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";

// Local imports
import { useQuoteData } from "./hooks";
import { currency, formatUKDate } from "./utils";
import { 
  StatusPill,
  QuoteTasksSection,
  QuoteNotesSection,
  QuoteSummaryTimeline,
  ShareQuotePanel,
  QuoteEngagement,
} from "./components";

export default function QuotePage({ isBooking = false }: { isBooking?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const [, quoteParams] = useRoute("/clients/:clientId/quotes/:quoteId");
  const [, bookingParams] = useRoute("/clients/:clientId/bookings/:quoteId");
  const params = isBooking ? bookingParams : quoteParams;

  const { role } = useRole();
  const clientId = params?.clientId ?? "";
  const quoteId = params?.quoteId ?? "";

  const { quote, clientData, isLoading, error, primaryImage, galleryImages } = useQuoteData(
    quoteId,
    clientId,
    isBooking
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const updateQuoteMutation = useUpdateQuote();
  const uploadImagesMutation = useUploadQuoteImages();
  const deleteImageMutation = useDeleteQuoteImage();
  const setPrimaryMutation = useSetPrimaryQuoteImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleImageUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;
    uploadImagesMutation.mutate(
      { quoteId, files: fileArray },
      {
        onSuccess: () => {
          toast({ title: `${fileArray.length} image${fileArray.length > 1 ? "s" : ""} uploaded` });
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
        },
        onError: (err: Error) => {
          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        },
      }
    );
  }, [quoteId, uploadImagesMutation, toast, queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  }, [handleImageUpload]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        tagSuggestionsRef.current &&
        !tagSuggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pageLabel =
    isBooking ||
    (quote && (quote.status === "accepted" || "booking_status" in quote))
      ? "Booking"
      : "Quote";

  if (isLoading) {
    return (
      <div
        className="flex h-[calc(100vh-56px)] items-center justify-center"
        data-testid="loading-quote"
      >
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div
        className="flex h-[calc(100vh-56px)] items-center justify-center"
        data-testid="error-quote"
      >
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
        {/* Header */}
        <div
          className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
          data-testid="row-quote-header"
        >
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
                  {quote.quoteTitle},{" "}
                  <span className="text-sm font-semibold text-[#000000]">
                    {currency.format(quote.pricePerPerson)}
                    pp
                  </span>
                </div>
                <StatusPill status={quote.status} />
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55"
                data-testid="text-quote-meta"
              >
                <span data-testid="text-quote-meta-destination">{quote.destinationName || quote.destination}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-dates">
                  {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                </span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-created">
                  Created {formatUKDate(quote.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate(
                  {
                    itemType: "quote",
                    itemId: quoteId,
                    label: quote.quoteTitle,
                    subtitle: `${clientData?.name || ""}${quote.destinationName ? " · " + quote.destinationName : ""}`,
                  },
                  {
                    onSuccess: (data: { favorited?: boolean }) => {
                      toast({
                        title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard",
                      });
                    },
                  }
                )
              }
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId)
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                  : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"
              }`}
              data-testid="button-pin-quote"
            >
              {userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId) ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
              {userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId)
                ? "Unpin"
                : "Pin"}
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-copy-quote"
              onClick={() => navigator.clipboard.writeText(`${quote.quoteTitle} (${quote.id})`)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90"
              data-testid="button-export-quote"
              onClick={() => {}}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Share Panel - always visible at top */}
        {quote && !isBooking && (
          <div className="mt-4" data-testid="share-panel-top">
            <ShareQuotePanel
              quoteId={quoteId}
              quoteTitle={quote.quoteTitle}
              destinationName={quote.destinationName || quote.destination}
              clientName={clientData?.name}
              clientEmail={(clientData as any)?.email}
              clientPhone={(clientData as any)?.phone || (clientData as any)?.mobile}
              agentName={quote.owner?.name}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
            {/* Main Content - Itinerary */}
            <Card
              className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
              data-testid="card-quote-itinerary"
            >
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                {/* Images */}
                <div className="grid content-start gap-1.5" data-testid="col-itinerary-media">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    data-testid="input-image-upload"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleImageUpload(e.target.files);
                        e.target.value = "";
                      }
                    }}
                  />
                  <div
                    className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition-colors ${
                      isDragging
                        ? "border-blue-400 bg-blue-50/50"
                        : "border-black/10 bg-black/[0.03]"
                    }`}
                    data-testid="img-itinerary-hero"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    {primaryImage ? (
                      <>
                        <img
                          src={primaryImage.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          data-testid="img-itinerary-hero-photo"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0"
                          aria-hidden
                        />
                        <div
                          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white"
                          data-testid="badge-main-image"
                        >
                          <Star className="h-3 w-3 fill-current" /> Main
                        </div>
                        <button
                          type="button"
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100 hover:opacity-100"
                          style={{ opacity: 1 }}
                          data-testid="button-delete-primary-image"
                          title="Remove image"
                          onClick={() => {
                            deleteImageMutation.mutate(
                              { quoteId, imageId: primaryImage.id },
                              {
                                onSuccess: () => {
                                  toast({ title: "Image removed" });
                                  queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                },
                              }
                            );
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-black/40 transition hover:text-black/60"
                        data-testid="button-upload-hero"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadImagesMutation.isPending ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6" />
                            <span className="text-xs font-medium">Drop or click to upload</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5" data-testid="grid-itinerary-gallery">
                      {galleryImages.map((img: { id: string; url: string; isPrimary: boolean | null }, idx: number) => (
                        <div
                          key={img.id}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)]"
                          data-testid={`card-gallery-image-${idx}`}
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            data-testid={`img-gallery-${idx}`}
                          />
                          <div
                            className="absolute inset-0 bg-black/0 transition group-hover:bg-black/30"
                            aria-hidden
                          />
                          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-amber-600 shadow-sm hover:bg-white"
                              data-testid={`button-set-primary-${idx}`}
                              title="Set as main image"
                              onClick={() => {
                                setPrimaryMutation.mutate(
                                  { quoteId, imageId: img.id },
                                  {
                                    onSuccess: () => {
                                      toast({ title: "Main image updated" });
                                      queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                    },
                                  }
                                );
                              }}
                            >
                              <Star className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm hover:bg-white"
                              data-testid={`button-delete-gallery-${idx}`}
                              title="Remove image"
                              onClick={() => {
                                deleteImageMutation.mutate(
                                  { quoteId, imageId: img.id },
                                  {
                                    onSuccess: () => {
                                      toast({ title: "Image removed" });
                                      queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                    },
                                  }
                                );
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(primaryImage || galleryImages.length > 0) && (
                    <button
                      type="button"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 bg-white/50 px-3 py-2 text-[11px] font-medium text-black/50 transition hover:border-black/25 hover:bg-white/70 hover:text-black/70"
                      data-testid="button-add-more-images"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadImagesMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      Add images
                    </button>
                  )}

                  {/* Tags */}
                  <div
                    className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5"
                    data-testid="card-quote-tags-inline"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold" data-testid="text-tags-title-inline">
                        Tags
                      </div>
                      <Tag className="h-3 w-3 text-black/35" aria-hidden />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags-inline">
                      {quote.tags.map((t) => (
                        <span
                          key={t}
                          className="group inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70"
                          data-testid={`pill-tag-inline-${t}`}
                        >
                          {t}
                          <button
                            type="button"
                            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/35 transition hover:bg-black/[0.06] hover:text-black/60"
                            data-testid={`button-remove-tag-inline-${t}`}
                            onClick={() => {
                              const updated = quote.tags.filter((tag) => tag !== t);
                              updateQuoteMutation.mutate(
                                { id: quoteId, data: { tags: updated } },
                                {
                                  onSuccess: () =>
                                    queryClient.invalidateQueries({ queryKey: ["quotes"] }),
                                }
                              );
                            }}
                          >
                            <X className="h-2.5 w-2.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative mt-2 flex items-center gap-1.5" data-testid="row-add-tag-inline">
                      <div className="relative flex-1">
                        <Input
                          ref={tagInputRef}
                          placeholder="Add tag…"
                          className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
                          data-testid="input-add-tag-inline"
                          value={newTag}
                          onChange={(e) => {
                            setNewTag(e.target.value);
                            setShowTagSuggestions(true);
                          }}
                          onFocus={() => setShowTagSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTag.trim()) {
                              const updated = [...quote.tags, newTag.trim()];
                              updateQuoteMutation.mutate(
                                { id: quoteId, data: { tags: updated } },
                                {
                                  onSuccess: () => {
                                    setNewTag("");
                                    setShowTagSuggestions(false);
                                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                  },
                                }
                              );
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote Details - TODO: Extract to QuoteDetails component */}
                <div className="min-w-0" data-testid="col-itinerary-details">
                  <div className="text-xs text-black/55">
                    Package: {quote.packageType}
                  </div>
                  <div className="mt-2 text-xs text-black/55">
                    Destination: {quote.destinationName || quote.destination}
                  </div>
                  {/* TODO: Add more quote details here based on package type */}
                </div>
              </div>
            </Card>

            {/* Sidebar - Share, Engagement, Tasks, Notes, Timeline */}
            <div className="space-y-3" data-testid="col-quote-sidebar">
              {quote && (
                <>
                  {!isBooking && (
                    <QuoteEngagement quoteId={quoteId} />
                  )}
                  <QuoteTasksSection
                    quoteId={quoteId}
                    entityType={isBooking ? "booking" : "quote"}
                    assignedUserId={(rawData as any)?.user_id}
                  />
                  <QuoteNotesSection transactionId={quoteId} />
                  <Card className="rounded-3xl border-black/10 bg-white/70 p-4">
                    <QuoteSummaryTimeline quote={quote} />
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
