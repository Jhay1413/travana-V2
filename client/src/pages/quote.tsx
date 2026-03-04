import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, Filter, MoreHorizontal, Pencil, RefreshCw, Star, Tag, X, Pin, PinOff, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuote, useBooking, useClient, useNeonClient, useTags, quoteKeys, bookingKeys } from "@/hooks/queries";
import { useDuplicateQuote, useConvertToBooking, useUpdateTransaction, useUpdateQuoteTags, useUpdateQuote } from "@/hooks/mutations";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import type { DealImage } from "@/types/quote";
import { QuoteEditDialog } from "@/components/quote-edit-dialog";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";
import { transformQuoteData, currency, formatUKDate, formatLeadSource } from "@/components/quote/quote-types";
import { QuoteNotesSection } from "@/components/quote/QuoteNotesSection";
import { QuoteTasksSection } from "@/components/quote/QuoteTasksSection";
import { QuoteSummaryTimeline } from "@/components/quote/QuoteSummaryTimeline";
import { StatusPill } from "@/components/quote/StatusPill";

export default function QuotePage() {
  const [, setLocation] = useLocation();
  const [, quoteParams] = useRoute("/clients/:clientId/quotes/:quoteId");
  const [, freeQuoteParams] = useRoute("/quotes/:quoteId");
  const params = quoteParams ?? freeQuoteParams;

  const { role } = useRole();
  const clientId = params?.clientId ?? "";
  const quoteId = params?.quoteId ?? "";

  const quoteQuery = useQuote(quoteId);
  const { data: quoteData, isLoading, error } = quoteQuery;
  const clientQuery = useClient(clientId);
  const clientData = clientQuery.data;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const duplicateQuoteMutation = useDuplicateQuote();
  const updateTagsMutation = useUpdateQuoteTags();
  const updateTransactionMutation = useUpdateTransaction();
  const convertToBookingMutation = useConvertToBooking();
  const updateQuoteMutation = useUpdateQuote();
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertHaysRef, setConvertHaysRef] = useState("");
  const [convertTourRef, setConvertTourRef] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const { data: allTagsData } = useTags();
  const allTags = useMemo(() => allTagsData?.map(t => t.name) || [], [allTagsData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
      if (tagSuggestionsRef.current && !tagSuggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current && !tagInputRef.current.contains(e.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const images = useMemo(() => {
    const imgs = quoteData?.images || [];
    return imgs.map((img: DealImage) => ({ id: img.id, url: img.image_url || "", isPrimary: img.isPrimary }));
  }, [quoteData]);
  const primaryImage = useMemo(() => images.find((img: { isPrimary: boolean | null }) => img.isPrimary) || images[0], [images]);
  const galleryImages = useMemo(() => images.filter((img: { id: string }) => img.id !== primaryImage?.id), [images, primaryImage]);

  const quote = useMemo(() => {
    if (!quoteData) return null;
    return transformQuoteData(quoteData);
  }, [quoteData]);

  const pageLabel = "Quote";

  if (isLoading) {
    return (
      <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => { }} filterSlot={<></>}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-quote">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (error || !quote) {
    return (
      <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => { }} filterSlot={<></>}>
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
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => { }} filterSlot={<></>}>
      <div className="px-5 pb-8 pt-5" data-testid="page-quote">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-quote-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => setLocation(clientId ? `/clients/${clientId}` : "/social-posts")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Client
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-quote-title">
                  {quote.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                </div>
                <StatusPill status={quote.status} />
                {quote.isCopyQuote && (
                  <span
                    className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                    data-testid="pill-quote-copy"
                  >
                    Copy Quote
                  </span>
                )}
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

          <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate(
                  { itemType: "quote", itemId: quoteId, label: quote.quoteTitle, subtitle: `${clientData?.name || ""}${quote.destinationName ? " · " + quote.destinationName : ""}` },
                  { onSuccess: (data: { favorited?: boolean }) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                )
              }
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId) ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
              data-testid="button-pin-quote"
            >
              {userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId) ? "Unpin" : "Pin"}
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
            <Button size="sm" className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90" data-testid="button-export-quote" onClick={() => { }}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid content-start gap-1.5" data-testid="col-itinerary-media">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]" data-testid="img-itinerary-hero">
                    {primaryImage ? (
                      <>
                        <img
                          src={primaryImage.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          data-testid="img-itinerary-hero-photo"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" aria-hidden />
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white" data-testid="badge-main-image">
                          <Star className="h-3 w-3 fill-current" /> Main
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-black/40" data-testid="placeholder-no-hero">
                        No images
                      </div>
                    )}
                  </div>

                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5" data-testid="grid-itinerary-gallery">
                      {galleryImages.map((img: { id: string; url: string; isPrimary: boolean | null }, idx: number) => (
                        <button
                          key={img.id}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] active:scale-[0.99]"
                          data-testid={`button-gallery-image-${idx}`}
                          onClick={() => { }}
                          title="Click to set as main image"
                        >
                          <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid={`img-gallery-${idx}`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100" aria-hidden />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[8px] font-semibold text-white opacity-0 transition group-hover:opacity-100" data-testid={`label-set-main-${idx}`}>
                            <Star className="h-2.5 w-2.5" /> Set as main
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5" data-testid="card-quote-tags-inline">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold" data-testid="text-tags-title-inline">Tags</div>
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
                              console.log('🏷️ Removing tag:', t);
                              const updated = quote.tags.filter((tag) => tag !== t);
                              updateTagsMutation.mutate(
                                { id: quoteId, tags: updated },
                                {
                                  onSuccess: () => {
                                    console.log('🏷️ Tag removed successfully');
                                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                  },
                                  onError: (error) => {
                                    console.error('🏷️ Failed to remove tag:', error);
                                    toast({ title: "Failed to remove tag", variant: "destructive" });
                                  }
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
                          onFocus={() => {
                            setShowTagSuggestions(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTag.trim()) {
                              e.preventDefault();
                              const updated = [...quote.tags, newTag.trim()];
                              console.log('🏷️ Adding tag:', newTag.trim(), 'Updated tags:', updated);
                              updateTagsMutation.mutate(
                                { id: quoteId, tags: updated },
                                {
                                  onSuccess: () => {
                                    console.log('🏷️ Tag added successfully');
                                    setNewTag("");
                                    setShowTagSuggestions(false);
                                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                    queryClient.invalidateQueries({ queryKey: ["tags"] });
                                  },
                                  onError: (error) => {
                                    console.error('🏷️ Failed to add tag:', error);
                                    toast({ title: "Failed to add tag", variant: "destructive" });
                                  }
                                }
                              );
                            }
                            if (e.key === "Escape") setShowTagSuggestions(false);
                          }}
                        />
                        {showTagSuggestions && (() => {
                          const filtered = allTags.filter(
                            (t) => (!newTag.trim() || t.toLowerCase().includes(newTag.trim().toLowerCase())) && !quote.tags.includes(t)
                          );
                          if (filtered.length === 0) return null;
                          return (
                            <div
                              ref={tagSuggestionsRef}
                              className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg"
                              data-testid="list-tag-suggestions"
                            >
                              {filtered.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  className="w-full px-2.5 py-1.5 text-left text-[11px] text-black/70 transition hover:bg-black/[0.04]"
                                  data-testid={`button-tag-suggestion-${t}`}
                                  onClick={() => {
                                    console.log('🏷️ Adding tag from suggestion:', t);
                                    const updated = [...quote.tags, t];
                                    updateTagsMutation.mutate(
                                      { id: quoteId, tags: updated },
                                      {
                                        onSuccess: () => {
                                          console.log('🏷️ Tag added successfully from suggestion');
                                          setNewTag("");
                                          setShowTagSuggestions(false);
                                          queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                          queryClient.invalidateQueries({ queryKey: ["tags"] });
                                        },
                                        onError: (error) => {
                                          console.error('🏷️ Failed to add tag from suggestion:', error);
                                          toast({ title: "Failed to add tag", variant: "destructive" });
                                        }
                                      }
                                    );
                                  }}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 rounded-xl bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
                        data-testid="button-add-tag-inline"
                        disabled={!newTag.trim()}
                        onClick={() => {
                          if (!newTag.trim()) return;
                          console.log('🏷️ Adding tag via button:', newTag.trim());
                          const updated = [...quote.tags, newTag.trim()];
                          updateTagsMutation.mutate(
                            { id: quoteId, tags: updated },
                            {
                              onSuccess: () => {
                                console.log('🏷️ Tag added successfully via button');
                                setNewTag("");
                                setShowTagSuggestions(false);
                                queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                queryClient.invalidateQueries({ queryKey: ["tags"] });
                              },
                              onError: (error) => {
                                console.error('🏷️ Failed to add tag via button:', error);
                                toast({ title: "Failed to add tag", variant: "destructive" });
                              }
                            }
                          );
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

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
                              <span>{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                            </span>
                          </div>
                         
                          {quoteData?.quote_ref && (
                            <a
                              href={quoteData.quote_ref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#3b82f6] transition hover:text-[#3b82f6]/80"
                              data-testid="link-view-link"
                            >
                              <LinkIcon className="h-3 w-3" />
                              View Link
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={quote.status || "QUOTE_IN_PROGRESS"}
                            onValueChange={(value) => {
                              if (value === "WON") {
                                setShowConvertDialog(true);
                              } else if (value === "LOST") {
                                updateQuoteMutation.mutate(
                                  { id: quoteId, data: { quote_status: "LOST" } },
                                  {
                                    onSuccess: () => {
                                      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
                                      toast({ title: "Quote marked as lost" });
                                    },
                                    onError: () => {
                                      toast({ title: "Failed to update status", variant: "destructive" });
                                    },
                                  }
                                );
                              } else {
                                updateQuoteMutation.mutate(
                                  { id: quoteId, data: { quote_status: value } },
                                  {
                                    onSuccess: () => {
                                      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
                                      toast({ title: "Quote status updated" });
                                    },
                                    onError: () => {
                                      toast({ title: "Failed to update status", variant: "destructive" });
                                    },
                                  }
                                );
                              }
                            }}
                          >
                            <SelectTrigger
                              className="h-8 w-[180px] rounded-full border-black/10 bg-white/70 text-[11px] font-semibold text-black/70"
                              data-testid="select-quote-status"
                            >
                              <Filter className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                              <SelectValue placeholder="Quote Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUOTE_IN_PROGRESS">Quote in Progress</SelectItem>
                              <SelectItem value="QUOTE_CALL">Quote Call</SelectItem>
                              <SelectItem value="AWAITING_DECISION">Awaiting Decision</SelectItem>
                              <SelectItem value="HOT_QUOTE">Hot Quote</SelectItem>
                              <SelectItem value="WON">Won</SelectItem>
                              <SelectItem value="LOST">Lost</SelectItem>
                            </SelectContent>
                          </Select>
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
                                ].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                                    data-testid={`button-quote-${item.id}`}
                                    onClick={() => {
                                      setShowEllipsisMenu(false);
                                      if (item.id === "edit") {
                                        setShowEditDialog(true);
                                      } else if (item.id === "convert") {
                                        setShowConvertDialog(true);
                                      } else {
                                        duplicateQuoteMutation.mutate(
                                          { id: quoteId, data: {} },
                                          {
                                            onSuccess: (newQuote) => {
                                              queryClient.invalidateQueries({ queryKey: ["quotes"] });
                                              toast({ title: "Quote duplicated successfully" });
                                              setLocation(clientId ? `/clients/${clientId}/quotes/${newQuote.id}` : `/quotes/${newQuote.id}`);
                                            },
                                            onError: () => {
                                              toast({ title: "Failed to duplicate quote", variant: "destructive" });
                                            },
                                          }
                                        );
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

                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
                    {quote.packageType?.toLowerCase().includes("hot tub") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lodge-type">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lodge-type-label">Lodge Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lodge-type-value">{quote.lodge?.type || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-pets">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-pets-label">Pets</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-pets-value">{quote.pets}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-guests">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-guests-label">Number of Guests</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-guests-value">{quote.passengers.adults + quote.passengers.children}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-nights">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-nights-label">Number of Nights</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-nights-value">{quote.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lead-source">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lead-source-label">Lead Source</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lead-source-value">{formatLeadSource(quote.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    ) : quote.packageType?.toLowerCase().includes("cruise") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cruise-line">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cruise-line-label">Cruise Line</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cruise-line-value">{quote.cruise?.cruiseLine || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-ship">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-ship-label">Ship</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-ship-value">{quote.cruise?.ship || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cabin-type">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cabin-type-label">Cabin Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cabin-type-value">{quote.cruise?.cabinType || "—"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cruise-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cruise-date-label">Cruise Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cruise-date-value">{quote.cruise?.cruiseDate ? formatUKDate(quote.cruise.cruiseDate) : "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-pre-cruise">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-pre-cruise-label">Pre-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-pre-cruise-value">{quote.cruise?.preCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-post-cruise">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-post-cruise-label">Post-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-post-cruise-value">{quote.cruise?.postCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children` : ""}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-hotel">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-hotel-label">Hotel</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-hotel-value">{quote.accommodation.property}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-room">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-room-label">Room Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-room-value">{quote.accommodation.roomType}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-board">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-board-label">Board Basis</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-board-value">{quote.accommodation.board}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-transfer">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-transfer-label">Transfer Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-transfer-value">{quote.transferType || "Private Transfer"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-departure-airport">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-departure-airport-label">Departure Airport</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-departure-airport-value">{quote.flights.outbound.from}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children (${quote.passengers.childAges.join(", ")})` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-nights">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-nights-label">Number of Nights</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-nights-value">{quote.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lead-source">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lead-source-label">Lead Source</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lead-source-value">{formatLeadSource(quote.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {(quote.status === "accepted" || quote.status === "BOOKED" || quote.haysRef || quote.supplierRef) && (
                    <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3" data-testid="card-booking-references">
                      <div className="text-xs font-semibold text-emerald-800 mb-2">Booking References</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-hays-reference">
                          <div className="text-xs font-semibold text-black/65">HAYS Reference</div>
                          <div className="text-xs font-semibold text-black" data-testid="text-hays-reference-value">{quote.haysRef || "—"}</div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-tour-reference">
                          <div className="text-xs font-semibold text-black/65">Supplier Reference</div>
                          <div className="text-xs font-semibold text-black" data-testid="text-tour-reference-value">{quote.supplierRef || "—"}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <QuoteNotesSection transactionId={quote.transaction_id} />


                </div>
              </div>
            </Card>

            <div className="grid gap-3" data-testid="col-quote-right">
              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-summary-right">
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
                    <TabsTrigger value="summary" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-summary">Quote Summary</TabsTrigger>
                    <TabsTrigger value="costings" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-costings">{pageLabel} Costings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-0">
                    <QuoteSummaryTimeline quote={quote} />
                  </TabsContent>

                  <TabsContent value="costings" className="mt-0">
                    <div className="flex items-center justify-between" data-testid="row-quote-summary-header">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-quote-summary-title">
                          {pageLabel} Costings
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-quote-summary-subtitle">
                          Commission and charges.
                        </div>
                      </div>
                      <FileText className="h-4 w-4 text-black/35" aria-hidden />
                    </div>

                    <div className="mt-3 grid gap-2" data-testid="list-quote-summary-lines">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-total-price">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-total-price-label">Total price</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-price-value">
                          {currency.format(quote.commissions.price)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-commission">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-commission-label">Comm</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-commission-value">
                          {currency.format(quote.commissions.commissionValue)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-discount">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-discount-label">Discount</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-discount-value">
                          {currency.format(quote.commissions.discounts)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-service-charge">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-service-charge-label">Service charge</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-service-charge-value">
                          {currency.format(quote.commissions.serviceCharge)}
                        </div>
                      </div>

                      <div className="my-1 h-px w-full bg-black/10" data-testid="separator-quote-summary" />

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-quote-summary-total-commission">
                        <div className="text-xs font-semibold text-black/70" data-testid="text-quote-summary-total-commission-label">Total commission</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-commission-value">
                          {currency.format(quote.commissions.totalCommission)}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>

              <QuoteTasksSection quoteId={quoteId} entityType="quote" assignedUserId={quoteData?.user_id} />

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
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-convert-booking">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Enter the booking references to convert this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
              <Input
                value={convertHaysRef}
                onChange={(e) => setConvertHaysRef(e.target.value)}
                placeholder="e.g. HAYS-12345"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-convert-hays-ref"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
              <Input
                value={convertTourRef}
                onChange={(e) => setConvertTourRef(e.target.value)}
                placeholder="e.g. TOUR-67890"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-convert-tour-ref"
              />
            </div>
            <Button
              className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
              data-testid="button-confirm-convert"
              onClick={() => {
                convertToBookingMutation.mutate(
                  { quoteId, haysRef: convertHaysRef, supplierRef: convertTourRef },
                  {
                    onSuccess: () => {
                      setShowConvertDialog(false);
                      setConvertHaysRef("");
                      setConvertTourRef("");
                      queryClient.invalidateQueries({ queryKey: ["quotes"] });
                      toast({ title: "Quote converted to booking" });
                      setLocation(`/clients/${clientId}/bookings/${quoteId}`);
                    },
                    onError: () => {
                      toast({ title: "Failed to convert", variant: "destructive" });
                    },
                  }
                );
              }}
              disabled={convertToBookingMutation.isPending}
            >
              {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}

