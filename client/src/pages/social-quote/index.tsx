import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ChevronLeft,
  Copy,
  FileText,
  Loader2,
  Pencil,
  PinOff,
  Pin,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import { useUpdateQuote, useDeleteQuote } from "@/hooks/mutations";
import { useSetPrimaryQuoteImage } from "@/features/quote/api/use-quote-image-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import { useQuoteData } from "@/features/social/components/social-quote/hooks";
import { currency, formatUKDate } from "@/features/social/components/social-quote/utils";
import { StatusPill, QuoteSummaryTimeline } from "@/features/social/components/social-quote";
import { QuoteItinerarySpecs } from "@/features/quote/components/QuoteItinerarySpecs";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DestinationGuru } from "@/features/destination-guru/components/destination-guru";
import type { DestinationGuruData } from "@/features/destination-guru/components/destination-guru";
import { useDestinationGuruSearch } from "@/features/destination-guru/api/use-destination-guru-queries";
import { useGenerateDestinationGuru } from "@/features/destination-guru/api/use-destination-guru-mutations";
import { useNeonClients } from "@/features/client/api/use-neon-client-queries";
import { useCurrentUser } from "@/hooks/queries";
import type { NeonClient } from "@/features/client/types/neon-client/neon-client.types";
import type { EnrichedQuote } from "@/features/quote/types";

export default function SocialQuotePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/social-posts/quotes/:quoteId");

  const { role } = useRole();
  const quoteId = params?.quoteId ?? "";

  // This page only ever renders quotes (isBooking=false), so narrow the
  // quote|booking union the hook returns to EnrichedQuote.
  const { quote, rawData: rawDataUnion, isLoading, error, primaryImage, galleryImages } = useQuoteData(quoteId, "", false);
  const rawData = rawDataUnion as EnrichedQuote | undefined;

  const discounts = parseFloat(rawData?.discounts || "0");
  const serviceCharge = parseFloat(rawData?.service_charge || "0");
  // package_commission already stores the total commission (operator % − discount + service charge).
  const packageCommission = parseFloat(rawData?.package_commission || "0");
  const totalCommission = packageCommission;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setPrimaryImage = useSetPrimaryQuoteImage();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<NeonClient | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGuruSheet, setShowGuruSheet] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { data: clientResults, isLoading: clientsLoading } = useNeonClients(
    showClientPicker ? { search: clientSearch, limit: 10 } : undefined
  );

  const isHotTub = (rawData as any)?.quote_type === "hot_tub_break" || quote?.packageType?.toLowerCase().includes("hot tub");
  const isCruise = !!quote?.cruise || !!quote?.packageType?.toLowerCase().includes("cruise");
  const isLodge = isHotTub || !!quote?.lodge || !!quote?.packageType?.toLowerCase().includes("lodge");
  // Reuse the client quote's itinerary spec renderer so the social post shows the
  // exact same package holiday / cruise / hot tub layout. QuoteItinerarySpecs consumes
  // the quote-feature cruise shape (itinerary uses `day`), so adapt the social
  // display shape (itinerary uses `dayNumber`) before handing it over.
  const quoteForSpecs = quote
    ? {
        ...quote,
        cruise: quote.cruise
          ? {
              ...quote.cruise,
              itinerary: (quote.cruise.itinerary ?? []).map((i) => ({
                day: i.dayNumber ?? 0,
                description: i.description ?? "",
                subDescription: i.subDescription ?? "",
              })),
            }
          : undefined,
      }
    : quote;
  const guruDestination = isHotTub
    ? [quote?.lodge?.parkName, quote?.lodge?.parkLocation].filter(Boolean).join(", ")
    : quote?.destinationName || quote?.destination || "";
  const { data: guruRecord } = useDestinationGuruSearch(guruDestination);
  const generateGuruMutation = useGenerateDestinationGuru();
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const updateQuoteMutation = useUpdateQuote();
  const deleteQuoteMutation = useDeleteQuote();

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

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-social-quote">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-social-quote">
        <div className="text-center">
          <p className="text-sm text-black/70">Failed to load quote</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/social-posts")}
          >
            Back to Social Posts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pb-8 pt-5" data-testid="page-social-quote">
        {/* Header */}
        <div
          className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
          data-testid="row-social-quote-header"
        >
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-social-posts"
              onClick={() => setLocation("/social-posts")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Social Posts
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-social-quote-title">
                  {quote.quoteTitle},{" "}
                  <span className="text-sm font-semibold text-[#000000]">
                    {currency.format(
                      quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1)
                    )}
                    pp
                  </span>
                </div>
                <StatusPill status={quote.status} />
                {rawData && 'quote_ref' in rawData && rawData.quote_ref && (
                  <a
                    href={rawData.quote_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                    data-testid="link-view-social-quote"
                  >
                    View
                  </a>
                )}
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55"
                data-testid="text-social-quote-meta"
              >
                <span data-testid="text-social-quote-meta-destination">{quote.destinationName || quote.destination}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-social-quote-meta-dates">
                  {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                </span>
                <span className="text-black/25">•</span>
                <span data-testid="text-social-quote-meta-created">
                  Created {formatUKDate(quote.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="row-social-quote-actions">
            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate(
                  {
                    itemType: "quote",
                    itemId: quoteId,
                    label: quote.quoteTitle,
                    subtitle: quote.destinationName ? ` · ${quote.destinationName}` : "",
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
              data-testid="button-pin-social-quote"
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
              data-testid="button-edit-social-quote"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {!showDeleteConfirm ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-2xl border-red-200 bg-white/70 text-red-600 hover:bg-red-50 hover:border-red-300"
                data-testid="button-delete-social-quote"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-red-600 text-white hover:bg-red-700"
                  data-testid="button-delete-social-quote-confirm"
                  disabled={deleteQuoteMutation.isPending}
                  onClick={async () => {
                    try {
                      await deleteQuoteMutation.mutateAsync(quoteId);
                      toast({ title: "Quote deleted" });
                      setLocation("/social-posts");
                    } catch {
                      toast({ title: "Failed to delete quote", variant: "destructive" });
                      setShowDeleteConfirm(false);
                    }
                  }}
                >
                  {deleteQuoteMutation.isPending ? "Deleting..." : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-2xl border-black/10 bg-white/70"
                  data-testid="button-delete-social-quote-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-copy-social-quote"
              onClick={() => {
                setSelectedClient(null);
                setClientSearch("");
                setShowClientPicker(true);
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm"
              data-testid="button-destination-guru-social-quote"
              onClick={() => setShowGuruSheet(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Destination Guru
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90"
              data-testid="button-export-social-quote"
              onClick={() => {}}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-4" data-testid="layout-social-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-social-quote-sections">
            {/* Main Content - Itinerary */}
            <Card
              className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
              data-testid="card-social-quote-itinerary"
            >
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-social-quote-itinerary-hero">
                {/* Images */}
                <div className="grid content-start gap-1.5" data-testid="col-social-quote-media">
                  <div
                    className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]"
                    data-testid="img-social-quote-hero"
                  >
                    {primaryImage ? (
                      <>
                        <img
                          src={primaryImage.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          data-testid="img-social-quote-hero-photo"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0"
                          aria-hidden
                        />
                        <div
                          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white"
                          data-testid="badge-social-quote-main-image"
                        >
                          <Star className="h-3 w-3 fill-current" /> Main
                        </div>
                      </>
                    ) : (
                      <div
                        className="flex h-full items-center justify-center text-xs text-black/40"
                        data-testid="placeholder-social-quote-no-hero"
                      >
                        No images
                      </div>
                    )}
                  </div>

                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5" data-testid="grid-social-quote-gallery">
                      {galleryImages.map((img: { id: string; url: string; isPrimary: boolean | null; ownerType?: string }, idx: number) => {
                        const isQuoteOwned = !img.ownerType || img.ownerType === "quote";
                        return (
                        <button
                          key={img.id}
                          type="button"
                          className={`group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] ${isQuoteOwned ? "active:scale-[0.99] cursor-pointer" : "cursor-default"}`}
                          data-testid={`button-social-quote-gallery-image-${idx}`}
                          disabled={setPrimaryImage.isPending || !isQuoteOwned}
                          onClick={() => {
                            if (!isQuoteOwned) return;
                            setPrimaryImage.mutate(
                              { quoteId, imageId: img.id },
                              {
                                onSuccess: () => toast({ title: "Main image updated" }),
                                onError: () => toast({ title: "Failed to update main image", variant: "destructive" }),
                              }
                            );
                          }}
                          title={isQuoteOwned ? "Set as main image" : "Cannot set accommodation image as main"}
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            data-testid={`img-social-quote-gallery-${idx}`}
                          />
                          <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-1.5 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                            {isQuoteOwned && (
                              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
                                <Star className="h-2.5 w-2.5" /> Set Main
                              </span>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tags */}
                  <div
                    className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5"
                    data-testid="card-social-quote-tags-inline"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold" data-testid="text-social-quote-tags-title">
                        Tags
                      </div>
                      <Tag className="h-3 w-3 text-black/35" aria-hidden />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-social-quote-tags">
                      {quote.tags.map((t) => (
                        <span
                          key={t}
                          className="group inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70"
                          data-testid={`pill-social-quote-tag-${t}`}
                        >
                          {t}
                          <button
                            type="button"
                            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/35 transition hover:bg-black/[0.06] hover:text-black/60"
                            data-testid={`button-remove-social-quote-tag-${t}`}
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
                    <div className="relative mt-2 flex items-center gap-1.5" data-testid="row-add-social-quote-tag">
                      <div className="relative flex-1">
                        <Input
                          ref={tagInputRef}
                          placeholder="Add tag…"
                          className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
                          data-testid="input-add-social-quote-tag"
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

                {/* Quote Details — mirror the client quote page (package holiday / cruise / hot tub) */}
                <div className="min-w-0" data-testid="col-social-quote-details">
                  <QuoteItinerarySpecs quote={quoteForSpecs} quoteData={rawData} />
                </div>
              </div>
            </Card>

            {/* Sidebar - Summary & Costings */}
            <div className="space-y-3" data-testid="col-social-quote-sidebar">
              {quote && (
                <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-social-quote-summary-right">
                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
                      <TabsTrigger value="summary" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-social-quote-summary">Quote Summary</TabsTrigger>
                      <TabsTrigger value="costings" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-social-quote-costings">Quote Costings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-0">
                      <QuoteSummaryTimeline quote={quote} />
                    </TabsContent>

                    <TabsContent value="costings" className="mt-0">
                      <div className="flex items-center justify-between" data-testid="row-social-quote-costings-header">
                        <div>
                          <div className="text-sm font-semibold" data-testid="text-social-quote-costings-title">Quote Costings</div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-social-quote-costings-subtitle">Commission and charges.</div>
                        </div>
                        <FileText className="h-4 w-4 text-black/35" aria-hidden />
                      </div>

                      <div className="mt-3 grid gap-2" data-testid="list-social-quote-costings">
                        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-total-price">
                          <div className="text-xs font-semibold text-black/65">Total price</div>
                          <div className="text-xs font-semibold text-black">{currency.format(quote.commissions.price)}</div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-commission">
                          <div className="text-xs font-semibold text-black/65">Comm</div>
                          <div className="text-xs font-semibold text-black">{currency.format(quote.commissions.commissionValue)}</div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-discount">
                          <div className="text-xs font-semibold text-black/65">Discount</div>
                          <div className="text-xs font-semibold text-black">{currency.format(discounts)}</div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-service-charge">
                          <div className="text-xs font-semibold text-black/65">Service charge</div>
                          <div className="text-xs font-semibold text-black">{currency.format(serviceCharge)}</div>
                        </div>
                        <div className="my-1 h-px w-full bg-black/10" />
                        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-social-quote-total-commission">
                          <div className="text-xs font-semibold text-black/70">Total commission</div>
                          <div className="text-xs font-semibold text-black">{currency.format(totalCommission)}</div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <QuoteEditDialog
        quoteId={quoteId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          setShowEditDialog(false);
          queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
        }}
      />

      <Sheet open={showGuruSheet} onOpenChange={setShowGuruSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 border-l border-black/10 bg-[#f8f8f8] dark:bg-[#0a0a0a]">
          <SheetHeader className="sr-only">
            <SheetTitle>Destination Guru</SheetTitle>
          </SheetHeader>
          <div className="p-5 pt-10">
            {guruRecord ? (
              <DestinationGuru
                destination={guruDestination}
                externalData={(guruRecord as any).data as DestinationGuruData}
                compact
                onClose={() => setShowGuruSheet(false)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="h-10 w-10 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No intel yet for {guruDestination || "this destination"}</h3>
                <p className="text-sm text-black/50 dark:text-white/50 mb-6 max-w-sm">
                  Generate AI-powered destination intelligence including weather, flight times, travel tips, and top activities.
                </p>
                <Button
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 text-white hover:from-amber-600 hover:to-orange-600"
                  disabled={!guruDestination || generateGuruMutation.isPending}
                  data-testid="button-generate-guru-sheet-social-quote"
                  onClick={() => {
                    generateGuruMutation.mutate(guruDestination, {
                      onSuccess: () => {
                        toast({ title: `Destination intel generated for ${guruDestination}` });
                      },
                      onError: (err: any) => {
                        toast({ title: "Failed to generate", description: err?.message, variant: "destructive" });
                      },
                    });
                  }}
                >
                  {generateGuruMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Generate Intel</>
                  )}
                </Button>
                {generateGuruMutation.isPending && (
                  <p className="text-xs text-black/40 dark:text-white/40 mt-4 animate-pulse">
                    AI is researching this destination. This may take 10-20 seconds…
                  </p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Client picker — step 1 of copy flow */}
      <Dialog open={showClientPicker} onOpenChange={(open) => { if (!open) { setShowClientPicker(false); setClientSearch(""); } }}>
        <DialogContent className="max-w-md rounded-3xl border-black/10 bg-white/95 p-6 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Copy to client</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Search and select the client this quote will be copied to.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <Input
              autoFocus
              placeholder="Search by name or email…"
              className="h-9 rounded-xl border-black/10 bg-white/70 pl-9 text-sm"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-black/10">
            {clientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (clientResults?.clients ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-black/40">
                {clientSearch ? "No clients found" : "Start typing to search"}
              </p>
            ) : (
              (clientResults?.clients ?? []).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition last:border-0 hover:bg-black/[0.03]"
                  onClick={() => {
                    setSelectedClient(client);
                    setShowClientPicker(false);
                    setShowCreateDialog(true);
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-semibold text-black/60">
                    {client.firstName?.[0]}{client.surename?.[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{client.firstName} {client.surename}</div>
                    {client.email && <div className="truncate text-xs text-black/45">{client.email}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {rawData && selectedClient && (() => {
        const splitDT = (iso: string | undefined | null) => {
          if (!iso) return { date: "", time: "" };
          const t = iso.indexOf("T");
          return t === -1
            ? { date: iso, time: "" }
            : { date: iso.substring(0, t), time: iso.substring(t + 1).substring(0, 5) };
        };

        const flights = rawData.flights || [];
        const outboundFlights = flights
          .filter((f) => f.flight_type === "outbound")
          .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
        const inboundFlights = flights
          .filter((f) => f.flight_type === "inbound")
          .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
        const outbound = outboundFlights[0];
        const inbound = inboundFlights[0];

        const accommodations = rawData.accommodations || [];
        const primaryAccom = accommodations.find((a) => a.is_primary) || accommodations[0];

        const outDep = splitDT(outbound?.departure_date_time);
        const outArr = splitDT(outbound?.arrival_date_time);
        const inDep = splitDT(inbound?.departure_date_time);
        const inArr = splitDT(inbound?.arrival_date_time);
        const checkIn = splitDT(primaryAccom?.check_in_date_time);

        return (
          <QuoteCreateDialog
            open={showCreateDialog}
            onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setSelectedClient(null); } }}
            clientId={selectedClient.id}
            userId={currentUser?.id || ""}
            markAsCopy={false}
            initialValues={{
              packageType: rawData.holiday_type_id || "",
              quoteTitle: rawData.title || "",
              leadSource: rawData.lead_source || "",
              status: rawData.quote_status || "draft",
              tourOperatorId: rawData.main_tour_operator_id || "",
              travelDate: rawData.travel_date?.toString().split("T")[0] || "",
              nights: rawData.num_of_nights || 7,
              passengersAdults: rawData.adult || 2,
              passengersChildren: rawData.child || 0,
              passengersInfants: rawData.infant || 0,
              transferType: rawData.transfer_type || "",
              preBookedSeats: rawData.pre_booked_seats || "",
              flightMeals: rawData.flight_meals ? "Yes" : "",
              country: rawData.country_id || "",
              destination: rawData.destination_id || "",
              resort: rawData.resort_id || "",
              accommodationId: primaryAccom?.accomodation_id || "",
              boardBasisId: primaryAccom?.board_basis_id || "",
              checkInDate: checkIn.date,
              checkInTime: checkIn.time,
              roomType: primaryAccom?.room_type || "",
              outboundDepartAirportId: outbound?.departing_airport_id || "",
              outboundArriveAirportId: outbound?.arrival_airport_id || "",
              outboundDepartDate: outDep.date,
              outboundDepartTime: outDep.time,
              outboundArriveDate: outArr.date,
              outboundArriveTime: outArr.time,
              outboundFlightNumber: outbound?.flight_number || "",
              outboundConnectingLegs: outboundFlights.slice(1).map((f) => {
                const dep = splitDT(f.departure_date_time);
                const arr = splitDT(f.arrival_date_time);
                return {
                  departAirportId: f.departing_airport_id || "",
                  departAirport: "",
                  arriveAirportId: f.arrival_airport_id || "",
                  arriveAirport: "",
                  departDate: dep.date,
                  departTime: dep.time,
                  arriveDate: arr.date,
                  arriveTime: arr.time,
                  flightNumber: f.flight_number || "",
                };
              }),
              inboundDepartAirportId: inbound?.departing_airport_id || "",
              inboundArriveAirportId: inbound?.arrival_airport_id || "",
              inboundDepartDate: inDep.date,
              inboundDepartTime: inDep.time,
              inboundArriveDate: inArr.date,
              inboundArriveTime: inArr.time,
              inboundFlightNumber: inbound?.flight_number || "",
              inboundConnectingLegs: inboundFlights.slice(1).map((f) => {
                const dep = splitDT(f.departure_date_time);
                const arr = splitDT(f.arrival_date_time);
                return {
                  departAirportId: f.departing_airport_id || "",
                  departAirport: "",
                  arriveAirportId: f.arrival_airport_id || "",
                  arriveAirport: "",
                  departDate: dep.date,
                  departTime: dep.time,
                  arriveDate: arr.date,
                  arriveTime: arr.time,
                  flightNumber: f.flight_number || "",
                };
              }),
              parkId: rawData.park_id || "",
              lodgeId: rawData.lodge_id || "",
              pets: rawData.pets ?? 0,
              price: parseFloat(String(rawData.sales_price || 0)) || 0,
              commission: parseFloat(String(rawData.package_commission || 0)) || 0,
              discount: parseFloat(String(rawData.discounts || 0)) || 0,
              serviceCharge: parseFloat(String(rawData.service_charge || 0)) || 0,
              pricePerPerson: parseFloat(String(rawData.price_per_person || 0)) || 0,
            }}
          />
        );
      })()}
    </>
  );
}
