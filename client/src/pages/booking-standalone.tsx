import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, Filter, MoreHorizontal, Pencil, Star, Tag, Trash2, X, Pin, PinOff, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useBooking, useNeonClient, useTags, bookingKeys } from "@/hooks/queries";
import { useUpdateTransaction, useUpdateQuoteTags, useAdminDeleteBooking } from "@/hooks/mutations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import type { DealImage } from "@/types/quote";
import { transformQuoteData, currency, formatUKDate, formatLeadSource } from "@/components/quote/quote-types";

const currencyPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { QuoteNotesSection } from "@/components/quote/QuoteNotesSection";
import { QuoteTasksSection } from "@/components/quote/QuoteTasksSection";
import { QuoteSummaryTimeline } from "@/components/quote/QuoteSummaryTimeline";
import { StatusPill } from "@/components/quote/StatusPill";
import { BookingEditDialog } from "@/components/booking-edit-dialog";

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
  const clientData = neonClientQuery.data ? { name: `${neonClientQuery.data.firstName || ""} ${neonClientQuery.data.surename || ""}`.trim() } : undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const updateTagsMutation = useUpdateQuoteTags();
  const updateTransactionMutation = useUpdateTransaction();
  const adminDeleteBookingMutation = useAdminDeleteBooking();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
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
    const imgs = bookingData?.images || [];
    return imgs.map((img: DealImage) => ({ id: img.id, url: img.image_url || "", isPrimary: img.isPrimary }));
  }, [bookingData]);
  const primaryImage = useMemo(() => images.find((img: { isPrimary: boolean | null }) => img.isPrimary) || images[0], [images]);
  const galleryImages = useMemo(() => images.filter((img: { id: string }) => img.id !== primaryImage?.id), [images, primaryImage]);

  const booking = useMemo(() => {
    if (!bookingData) return null;
    return transformQuoteData(bookingData);
  }, [bookingData]);

  if (isLoading) {
    return (
      <CommandCenterShell role={role} title="Booking" theme="light" onRoleChange={() => { }} filterSlot={<></>}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-booking">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (error || !booking) {
    return (
      <CommandCenterShell role={role} title="Booking" theme="light" onRoleChange={() => { }} filterSlot={<></>}>
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
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title="Booking" theme="light" onRoleChange={() => { }} filterSlot={<></>}>
      <div className="px-5 pb-8 pt-5" data-testid="page-booking">
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

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-booking-title">
                  {booking.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(booking.commissions.price / (booking.passengers.adults + booking.passengers.children || 1))}pp</span>
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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="row-booking-actions">
            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate(
                  { itemType: "booking", itemId: bookingId, label: booking.quoteTitle, subtitle: `${clientData?.name || ""}${booking.destinationName ? " · " + booking.destinationName : ""}` },
                  { onSuccess: (data: { favorited?: boolean }) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                )
              }
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === bookingId) ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
              data-testid="button-pin-booking"
            >
              {userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === bookingId) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === bookingId) ? "Unpin" : "Pin"}
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-copy-booking"
              onClick={() => navigator.clipboard.writeText(`${booking.quoteTitle} (${booking.id})`)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button size="sm" className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90" data-testid="button-export-booking" onClick={() => { }}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-booking-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-booking-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-booking-itinerary">
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

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5" data-testid="card-booking-tags-inline">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold" data-testid="text-tags-title-inline">Tags</div>
                      <Tag className="h-3 w-3 text-black/35" aria-hidden />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags-inline">
                      {booking.tags.map((t) => (
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
                              const updated = booking.tags.filter((tag) => tag !== t);
                              updateTagsMutation.mutate(
                                { id: bookingId, tags: updated },
                                {
                                  onSuccess: () => {
                                    queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                  },
                                  onError: () => {
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
                              const updated = [...booking.tags, newTag.trim()];
                              updateTagsMutation.mutate(
                                { id: bookingId, tags: updated },
                                {
                                  onSuccess: () => {
                                    setNewTag("");
                                    setShowTagSuggestions(false);
                                    queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                    queryClient.invalidateQueries({ queryKey: ["tags"] });
                                  },
                                  onError: () => {
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
                            (t) => (!newTag.trim() || t.toLowerCase().includes(newTag.trim().toLowerCase())) && !booking.tags.includes(t)
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
                                    const updated = [...booking.tags, t];
                                    updateTagsMutation.mutate(
                                      { id: bookingId, tags: updated },
                                      {
                                        onSuccess: () => {
                                          setNewTag("");
                                          setShowTagSuggestions(false);
                                          queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                          queryClient.invalidateQueries({ queryKey: ["tags"] });
                                        },
                                        onError: () => {
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
                          const updated = [...booking.tags, newTag.trim()];
                          updateTagsMutation.mutate(
                            { id: bookingId, tags: updated },
                            {
                              onSuccess: () => {
                                setNewTag("");
                                setShowTagSuggestions(false);
                                queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                queryClient.invalidateQueries({ queryKey: ["tags"] });
                              },
                              onError: () => {
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
                          <div className="flex items-center gap-2" data-testid="text-itinerary-booking-title">
                            <span className="truncate text-base font-semibold">{booking.quoteTitle},</span>
                            <span className="flex items-center gap-1.5 font-semibold text-[14px] text-[#000000]" data-testid="text-itinerary-booking-summary">
                              <span>{(() => {
                                const start = new Date(booking.travelDate);
                                const end = new Date(booking.returnDate);
                                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                return `${nights} nights`;
                              })()}</span>
                              <span className="text-black/25">•</span>
                              <span>{currency.format(booking.commissions.price / (booking.passengers.adults + booking.passengers.children || 1))}pp</span>
                            </span>
                          </div>
                          {booking.quoteLink && booking.quoteLink !== "#" && (
                            <a
                              href={booking.quoteLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#3b82f6] transition hover:text-[#3b82f6]/80"
                              data-testid="link-booking-link"
                            >
                              <LinkIcon className="h-3 w-3" />
                              View Booking Link
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <UserReassignSelect
                            value={bookingData?.user_id || currentUser?.id || ""}
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
                              className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                              data-testid="button-booking-ellipsis"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showEllipsisMenu && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-booking-ellipsis">
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
                                {role === "Admin" && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
                                    data-testid="button-booking-admin-delete"
                                    onClick={() => {
                                      setShowEllipsisMenu(false);
                                      setDeleteReason("");
                                      setShowDeleteDialog(true);
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
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        <span className="text-sm text-black/55" data-testid="text-itinerary-location">{booking.destinationName || booking.destination}</span>
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

                  <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3" data-testid="card-booking-references">
                    <div className="text-xs font-semibold text-emerald-800 mb-2">Booking References</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-hays-reference">
                        <div className="text-xs font-semibold text-black/65">HAYS Reference</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-hays-reference-value">{booking.haysRef || "—"}</div>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-tour-reference">
                        <div className="text-xs font-semibold text-black/65">Supplier Reference</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-tour-reference-value">{booking.supplierRef || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
                    {booking.packageType?.toLowerCase().includes("hot tub") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(booking.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lodge-type">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lodge-type-label">Lodge Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lodge-type-value">{booking.lodge?.type || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-pets">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-pets-label">Pets</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-pets-value">{booking.pets}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-guests">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-guests-label">Number of Guests</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-guests-value">{booking.passengers.adults + booking.passengers.children}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{booking.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {booking.passengers.adults} Adults{booking.passengers.children ? `, ${booking.passengers.children} Children` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-nights">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-nights-label">Number of Nights</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-nights-value">{booking.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lead-source">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lead-source-label">Lead Source</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lead-source-value">{formatLeadSource(booking.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    ) : booking.packageType?.toLowerCase().includes("cruise") ? (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(booking.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cruise-line">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cruise-line-label">Cruise Line</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cruise-line-value">{booking.cruise?.cruiseLine || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-ship">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-ship-label">Ship</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-ship-value">{booking.cruise?.ship || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cabin-type">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cabin-type-label">Cabin Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cabin-type-value">{booking.cruise?.cabinType || "—"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{booking.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-cruise-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-cruise-date-label">Cruise Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-cruise-date-value">{booking.cruise?.cruiseDate ? formatUKDate(booking.cruise.cruiseDate) : "—"}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-pre-cruise">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-pre-cruise-label">Pre-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-pre-cruise-value">{booking.cruise?.preCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-post-cruise">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-post-cruise-label">Post-Cruise Stay</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-post-cruise-value">{booking.cruise?.postCruiseStay || 0} nights</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {booking.passengers.adults} Adults{booking.passengers.children ? `, ${booking.passengers.children} Children` : ""}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-travel-date-value">{formatUKDate(booking.travelDate)}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-hotel">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-hotel-label">Hotel</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-hotel-value">{booking.accommodation.property}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-room">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-room-label">Room Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-room-value">{booking.accommodation.roomType}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-board">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-board-label">Board Basis</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-board-value">{booking.accommodation.board}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-transfer">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-transfer-label">Transfer Type</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-transfer-value">{booking.transferType || "Private Transfer"}</div>
                          </div>
                        </div>
                        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-operator-value">{booking.commissions.tourOperator}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-departure-airport">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-departure-airport-label">Departure Airport</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-departure-airport-value">{booking.flights.outbound.from}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-passengers-value">
                              {booking.passengers.adults} Adults{booking.passengers.children ? `, ${booking.passengers.children} Children (${booking.passengers.childAges.join(", ")})` : ""}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-nights">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-nights-label">Number of Nights</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-nights-value">{booking.nights}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lead-source">
                            <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lead-source-label">Lead Source</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-itinerary-lead-source-value">{formatLeadSource(booking.leadSource)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <QuoteNotesSection transactionId={booking.transaction_id} />

                </div>
              </div>
            </Card>

            <div className="grid gap-3" data-testid="col-booking-right">
              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-booking-summary-right">
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
                    <TabsTrigger value="summary" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-booking-summary">Booking Summary</TabsTrigger>
                    <TabsTrigger value="costings" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-booking-costings">Booking Costings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-0">
                    <QuoteSummaryTimeline quote={booking} />
                  </TabsContent>

                  <TabsContent value="costings" className="mt-0">
                    <div className="flex items-center justify-between" data-testid="row-booking-summary-header">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-booking-summary-title">
                          Booking Costings
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-booking-summary-subtitle">
                          Commission and charges.
                        </div>
                      </div>
                      <FileText className="h-4 w-4 text-black/35" aria-hidden />
                    </div>

                    <div className="mt-3 grid gap-2" data-testid="list-booking-summary-lines">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-booking-summary-total-price">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-total-price-label">Total price</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-total-price-value">
                          {currency.format(booking.commissions.price)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-booking-summary-commission">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-commission-label">Comm</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-commission-value">
                          {currency.format(booking.commissions.commissionValue)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-booking-summary-discount">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-discount-label">Discount</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-discount-value">
                          {currency.format(booking.commissions.discounts)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-booking-summary-service-charge">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-service-charge-label">Service charge</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-service-charge-value">
                          {currency.format(booking.commissions.serviceCharge)}
                        </div>
                      </div>

                      {bookingData?.hasReferral && (
                        <>
                          <div className="my-1 h-px w-full bg-black/10" data-testid="separator-booking-summary" />

                          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2" data-testid="row-booking-summary-referral-payout">
                            <div className="text-xs font-semibold text-amber-700" data-testid="text-booking-summary-referral-payout-label">
                              Referral payout (25%)
                              <span className="ml-1 font-normal text-amber-500/70">est.</span>
                            </div>
                            <div className="text-xs font-semibold text-amber-700" data-testid="text-booking-summary-referral-payout-value">
                              {currencyPence.format(booking.commissions.referralPayout)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-booking-summary-net-commission">
                            <div className="text-xs font-semibold text-black/70" data-testid="text-booking-summary-net-commission-label">Net commission</div>
                            <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-net-commission-value">
                              {currencyPence.format(booking.commissions.netCommission)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>

              <QuoteTasksSection quoteId={bookingId} entityType="booking" assignedUserId={bookingData?.user_id} />

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
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-red-200 bg-white/95 backdrop-blur-xl" data-testid="dialog-admin-delete-booking">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-red-600">Delete Booking</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              This action cannot be undone. Please provide a reason for deleting this booking.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Reason for deletion</Label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter the reason for deleting this record..."
                className="min-h-[80px] w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                data-testid="textarea-delete-reason"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-9 flex-1 rounded-xl border-black/10"
                onClick={() => setShowDeleteDialog(false)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                className="h-9 flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700"
                data-testid="button-confirm-delete"
                disabled={!deleteReason.trim() || adminDeleteBookingMutation.isPending}
                onClick={() => {
                  adminDeleteBookingMutation.mutate(
                    { id: bookingId, reason: deleteReason.trim() },
                    {
                      onSuccess: () => {
                        setShowDeleteDialog(false);
                        toast({ title: "Booking deleted successfully" });
                        setLocation(clientId ? `/clients/${clientId}` : "/bookings");
                      },
                      onError: () => {
                        toast({ title: "Failed to delete booking", variant: "destructive" });
                      },
                    }
                  );
                }}
              >
                {adminDeleteBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}
