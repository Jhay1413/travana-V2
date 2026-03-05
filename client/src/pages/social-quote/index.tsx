import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import { useUpdateQuote } from "@/hooks/mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import { useQuoteData } from "@/pages/quote/hooks";
import { currency, formatUKDate, formatLeadSource } from "@/pages/quote/utils";
import { StatusPill, QuoteSummaryTimeline } from "@/pages/quote/components";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";

export default function SocialQuotePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/social-posts/quotes/:quoteId");

  const { role } = useRole();
  const quoteId = params?.quoteId ?? "";

  const { quote, rawData, isLoading, error, primaryImage, galleryImages } = useQuoteData(quoteId, "", false);

  const discounts = parseFloat(rawData?.discounts || "0");
  const serviceCharge = parseFloat(rawData?.service_charge || "0");
  const packageCommission = parseFloat(rawData?.package_commission || "0");
  const totalCommission = packageCommission - discounts + serviceCharge;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const updateQuoteMutation = useUpdateQuote();

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
      <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-social-quote">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (error || !quote) {
    return (
      <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
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
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
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
              data-testid="button-copy-social-quote"
              onClick={() => setShowCreateDialog(true)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
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
                      {galleryImages.map((img: { id: string; url: string; isPrimary: boolean | null }, idx: number) => (
                        <button
                          key={img.id}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] active:scale-[0.99]"
                          data-testid={`button-social-quote-gallery-image-${idx}`}
                          onClick={() => {}}
                          title="Gallery image"
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            data-testid={`img-social-quote-gallery-${idx}`}
                          />
                          <div
                            className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100"
                            aria-hidden
                          />
                        </button>
                      ))}
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

                {/* Quote Details */}
                <div className="min-w-0" data-testid="col-social-quote-details">
                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-social-quote-specs">
                    {quote.packageType?.toLowerCase().includes("hot tub") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-travel-date">
                            <div className="text-xs font-semibold text-black/65">Travel Date</div>
                            <div className="text-xs font-semibold text-black">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-lodge-type">
                            <div className="text-xs font-semibold text-black/65">Lodge Type</div>
                            <div className="text-xs font-semibold text-black">{quote.lodge?.type || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-pets">
                            <div className="text-xs font-semibold text-black/65">Pets</div>
                            <div className="text-xs font-semibold text-black">{quote.pets}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-guests">
                            <div className="text-xs font-semibold text-black/65">Number of Guests</div>
                            <div className="text-xs font-semibold text-black">{quote.passengers.adults + quote.passengers.children}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-operator">
                            <div className="text-xs font-semibold text-black/65">Tour Operator</div>
                            <div className="text-xs font-semibold text-black">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-passengers">
                            <div className="text-xs font-semibold text-black/65">Passengers</div>
                            <div className="text-xs font-semibold text-black">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-nights">
                            <div className="text-xs font-semibold text-black/65">Number of Nights</div>
                            <div className="text-xs font-semibold text-black">{quote.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-lead-source">
                            <div className="text-xs font-semibold text-black/65">Lead Source</div>
                            <div className="text-xs font-semibold text-black">{formatLeadSource(quote.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    ) : quote.packageType?.toLowerCase().includes("cruise") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-travel-date">
                            <div className="text-xs font-semibold text-black/65">Travel Date</div>
                            <div className="text-xs font-semibold text-black">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-cruise-line">
                            <div className="text-xs font-semibold text-black/65">Cruise Line</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.cruiseLine || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-ship">
                            <div className="text-xs font-semibold text-black/65">Ship</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.ship || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-cabin-type">
                            <div className="text-xs font-semibold text-black/65">Cabin Type</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.cabinType || "—"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-operator">
                            <div className="text-xs font-semibold text-black/65">Tour Operator</div>
                            <div className="text-xs font-semibold text-black">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-cruise-date">
                            <div className="text-xs font-semibold text-black/65">Cruise Date</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.cruiseDate ? formatUKDate(quote.cruise.cruiseDate) : "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-pre-cruise">
                            <div className="text-xs font-semibold text-black/65">Pre-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.preCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-post-cruise">
                            <div className="text-xs font-semibold text-black/65">Post-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black">{quote.cruise?.postCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-passengers">
                            <div className="text-xs font-semibold text-black/65">Passengers</div>
                            <div className="text-xs font-semibold text-black">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children` : ""}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-travel-date">
                            <div className="text-xs font-semibold text-black/65">Travel Date</div>
                            <div className="text-xs font-semibold text-black">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-hotel">
                            <div className="text-xs font-semibold text-black/65">Hotel</div>
                            <div className="text-xs font-semibold text-black">{quote.accommodation.property}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-room">
                            <div className="text-xs font-semibold text-black/65">Room Type</div>
                            <div className="text-xs font-semibold text-black">{quote.accommodation.roomType}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-board">
                            <div className="text-xs font-semibold text-black/65">Board Basis</div>
                            <div className="text-xs font-semibold text-black">{quote.accommodation.board}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-transfer">
                            <div className="text-xs font-semibold text-black/65">Transfer Type</div>
                            <div className="text-xs font-semibold text-black">{quote.transferType || "Private Transfer"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-social-quote-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-operator">
                            <div className="text-xs font-semibold text-black/65">Tour Operator</div>
                            <div className="text-xs font-semibold text-black">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-departure-airport">
                            <div className="text-xs font-semibold text-black/65">Departure Airport</div>
                            <div className="text-xs font-semibold text-black">{quote.flights.outbound.from}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-passengers">
                            <div className="text-xs font-semibold text-black/65">Passengers</div>
                            <div className="text-xs font-semibold text-black">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children (${quote.passengers.childAges.join(", ")})` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-nights">
                            <div className="text-xs font-semibold text-black/65">Number of Nights</div>
                            <div className="text-xs font-semibold text-black">{quote.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-social-quote-lead-source">
                            <div className="text-xs font-semibold text-black/65">Lead Source</div>
                            <div className="text-xs font-semibold text-black">{formatLeadSource(quote.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
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
      {rawData && (() => {
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
            onOpenChange={setShowCreateDialog}
            transactionId={rawData.transaction_id ?? undefined}
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
              pets: (rawData.pets ?? 0) > 0,
              price: parseFloat(String(rawData.sales_price || 0)) || 0,
              commission: parseFloat(String(rawData.package_commission || 0)) || 0,
              discount: parseFloat(String(rawData.discounts || 0)) || 0,
              serviceCharge: parseFloat(String(rawData.service_charge || 0)) || 0,
              pricePerPerson: parseFloat(String(rawData.price_per_person || 0)) || 0,
            }}
          />
        );
      })()}
    </CommandCenterShell>
  );
}
