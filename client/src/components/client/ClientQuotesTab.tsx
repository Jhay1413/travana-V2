import {
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Pin,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DealImage } from "@/types/quote";
import type { Favorite } from "@/api/endpoints/favorite.api";
import { currency, formatUKDate, type QuoteWithJoins, type BookingWithJoins, type Client } from "./client-types";
import type { Transaction } from "@/types/quote";

interface ClientQuotesTabProps {
  quotes: QuoteWithJoins[];
  bookings: BookingWithJoins[];
  transactions: Transaction[];
  clientId: string;
  navigate: (to: string) => void;
  onNewQuote: () => void;
  expandedCopyGroups: Record<string, boolean>;
  setExpandedCopyGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  client: Client | null;
  userFavorites: Favorite[] | undefined;
  toggleFavoriteMutation: { mutate: (args: { itemType: string; itemId: string; label: string; subtitle: string }) => void };
}

export function ClientQuotesTab({
  quotes,
  bookings,
  transactions,
  clientId,
  navigate,
  onNewQuote,
  expandedCopyGroups,
  setExpandedCopyGroups,
  client,
  userFavorites,
  toggleFavoriteMutation,
}: ClientQuotesTabProps) {
  // Create a map of transaction_id to transaction status
  const transactionStatusMap = new Map<string, string>();
  transactions.forEach((t) => {
    if (t.id && t.status) {
      transactionStatusMap.set(t.id, t.status);
    }
  });

  return (
    <div className="grid gap-3" data-testid="layout-quotes">
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quotes-list">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" data-testid="text-quotes-title">
              Quotes
            </div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-quotes-subtitle">
              Quick view of recent quotes for this client.
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
            data-testid="button-quotes-new"
            onClick={onNewQuote}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            New quote
          </Button>
        </div>

        <div className="mt-4 space-y-2" data-testid="section-quotes-groups">
          {[
            {
              id: "in-play",
              title: "In Play",
              rows: quotes
                .filter((q: QuoteWithJoins) => {
                  // Exclude quotes with won/lost/archived status
                  if (q.quote_status && ["WON", "LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status)) {
                    return false;
                  }
                  // Exclude quotes whose transaction is on_booking status
                  const txnStatus = transactionStatusMap.get(q.transaction_id);
                  if (txnStatus === "on_booking") {
                    return false;
                  }
                  return true;
                })
                .map((q: QuoteWithJoins) => {
                  const salesPrice = parseFloat(q.sales_price || "0");
                  const discount = parseFloat(q.discounts || "0");
                  const serviceCharge = parseFloat(q.service_charge || "0");
                  const netPrice = salesPrice - discount + serviceCharge;
                  
                  return {
                    id: q.id,
                    transactionId: q.transaction_id,
                    title: q.title || q.holiday_type_name || "Trip",
                    isQuoteCopy: Boolean(q.isQuoteCopy),
                    destination: q.holiday_type_name || q.quote_type || "—",
                    travelDate: q.travel_date,
                    createdAt: q.date_created ? new Date(q.date_created).toLocaleDateString("en-GB") : "—",
                    createdAtRaw: q.date_created || "",
                    status: q.quote_status || "NEW_LEAD",
                    totalCost: netPrice,
                    pricePerPerson: parseFloat(q.price_per_person || "0"),
                    imageUrl: q.images?.find((img: DealImage) => img.isPrimary)?.image_url || q.images?.[0]?.image_url || null,
                    pax: `${q.adult || 0}A${(q.child || 0) > 0 ? ` ${q.child}C` : ""}${(q.infant || 0) > 0 ? ` ${q.infant}I` : ""}`,
                    nights: q.num_of_nights || 0,
                  };
                }),
            },
            {
              id: "won",
              title: "Won (Bookings)",
              rows: bookings
                .map((b: BookingWithJoins) => {
                  const salesPrice = parseFloat(b.sales_price || "0");
                  const discount = parseFloat(b.discounts || "0");
                  const serviceCharge = parseFloat(b.service_charge || "0");
                  const netPrice = salesPrice - discount + serviceCharge;
                  
                  return {
                    id: b.id,
                    transactionId: b.transaction_id || "",
                    title: b.title || b.holiday_type_name || "Booking",
                    isQuoteCopy: false,
                    destination: b.holiday_type_name || "—",
                    travelDate: b.travel_date,
                    createdAt: b.date_created ? new Date(b.date_created).toLocaleDateString("en-GB") : "—",
                    createdAtRaw: b.date_created || "",
                    status: b.booking_status || "BOOKED",
                    totalCost: netPrice,
                    pricePerPerson: 0,
                    imageUrl: b.images?.find((img: DealImage) => img.isPrimary)?.image_url || b.images?.[0]?.image_url || null,
                    pax: `${b.adult || 0}A${(b.child || 0) > 0 ? ` ${b.child}C` : ""}${(b.infant || 0) > 0 ? ` ${b.infant}I` : ""}`,
                    nights: b.num_of_nights || 0,
                    haysRef: b.hays_ref,
                    supplierRef: b.supplier_ref,
                    isBooking: true,
                  };
                }),
            },
          ].map((group) => {
            const groupRowsSorted = [...group.rows].sort(
              (a, b) => new Date(b.createdAtRaw || 0).getTime() - new Date(a.createdAtRaw || 0).getTime(),
            );
            const mainRows = groupRowsSorted.filter((row) => !row.isQuoteCopy);
            const copyRows = groupRowsSorted.filter((row) => row.isQuoteCopy);

            const rowsWithToggles: Array<
              | { type: "quote"; row: (typeof groupRowsSorted)[number]; isChild: boolean }
              | { type: "toggle"; parentId: string; count: number }
            > = [];

            for (const main of mainRows) {
              const copies = copyRows.filter((copy) => copy.transactionId === main.transactionId);
              rowsWithToggles.push({ type: "quote", row: main, isChild: false });
              if (copies.length > 0) {
                rowsWithToggles.push({ type: "toggle", parentId: main.id, count: copies.length });
                if (expandedCopyGroups[main.id]) {
                  for (const copy of copies) {
                    rowsWithToggles.push({ type: "quote", row: copy, isChild: true });
                  }
                }
              }
            }

            const orphanCopyRows = copyRows.filter(
              (copy) => !mainRows.some((main) => main.transactionId === copy.transactionId),
            );
            for (const orphan of orphanCopyRows) {
              rowsWithToggles.push({ type: "quote", row: orphan, isChild: true });
            }

            return (
              <div key={group.id} className="rounded-3xl border border-black/10 bg-white/60 p-2" data-testid={`group-quotes-${group.id}`}>
                <div className="flex items-center justify-between gap-3 px-2 py-2" data-testid={`row-quotes-group-header-${group.id}`}>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-black/80" data-testid={`text-quotes-group-title-${group.id}`}>
                      {group.title}
                    </div>
                    <span
                      className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/60"
                      data-testid={`pill-quotes-group-count-${group.id}`}
                    >
                      {group.rows.length}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2" data-testid={`list-quotes-${group.id}`}>
                  {rowsWithToggles.map((item) => {
                    if (item.type === "toggle") {
                      const isExpanded = Boolean(expandedCopyGroups[item.parentId]);
                      return (
                        <button
                          key={`toggle-${item.parentId}`}
                          type="button"
                          className="ml-6 inline-flex w-fit items-center gap-1 rounded-xl border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black/65 transition hover:bg-black/[0.03]"
                          data-testid={`button-toggle-copy-quotes-${item.parentId}`}
                          onClick={() =>
                            setExpandedCopyGroups((prev) => ({
                              ...prev,
                              [item.parentId]: !prev[item.parentId],
                            }))
                          }
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`} />
                          {isExpanded ? "Hide" : "Show"} {item.count} {item.count === 1 ? "copy" : "copies"}
                        </button>
                      );
                    }

                    const q = item.row;
                    const isBooking = (q as any).isBooking;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99] ${item.isChild ? "pl-9 border-sky-500/20 bg-sky-500/[0.04]" : ""}`}
                        data-testid={`card-${isBooking ? 'booking' : 'quote'}-intro-${q.id}`}
                        onClick={() => navigate(`/clients/${clientId}/${isBooking ? 'bookings' : 'quotes'}/${q.id}`)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent"
                            data-testid={`img-quote-${q.id}`}
                            aria-hidden
                          >
                            {q.imageUrl ? (
                              <img
                                src={q.imageUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                data-testid={`img-quote-photo-${q.id}`}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-black/20">
                                <ImagePlus className="h-6 w-6" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-semibold" data-testid={`text-${isBooking ? 'booking' : 'quote'}-title-${q.id}`}>
                                    {q.title}
                                  </div>
                                  {isBooking && (
                                    <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      {q.status}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                  <span data-testid={`text-${isBooking ? 'booking' : 'quote'}-destination-${q.id}`}>{q.destination || "—"}</span>
                                  <span className="text-black/25">•</span>
                                  <span data-testid={`text-${isBooking ? 'booking' : 'quote'}-traveldate-${q.id}`}>{formatUKDate(q.travelDate)}</span>
                                  <span className="text-black/25">•</span>
                                  <span data-testid={`text-${isBooking ? 'booking' : 'quote'}-created-${q.id}`}>Created {q.createdAt || "—"}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                  <span data-testid={`text-${isBooking ? 'booking' : 'quote'}-pax-${q.id}`}>{q.pax}</span>
                                  {q.nights > 0 && (
                                    <>
                                      <span className="text-black/25">•</span>
                                      <span data-testid={`text-${isBooking ? 'booking' : 'quote'}-nights-${q.id}`}>{q.nights}N</span>
                                    </>
                                  )}
                                  {q.isQuoteCopy && (
                                    <>
                                      <span className="text-black/25">•</span>
                                      <span
                                        className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700"
                                        data-testid={`text-quote-copy-${q.id}`}
                                      >
                                        Copy
                                      </span>
                                    </>
                                  )}
                                  {!isBooking && (
                                    <>
                                      <span className="text-black/25">•</span>
                                      <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/60" data-testid={`text-quote-status-${q.id}`}>
                                        {(q.status || "").replace(/_/g, " ")}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {isBooking && ((q as any).haysRef || (q as any).supplierRef) && (
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-black/60">
                                    {(q as any).haysRef && (
                                      <span data-testid={`text-booking-hays-${q.id}`}>
                                        HAYS Ref: <span className="font-semibold text-black/80">{(q as any).haysRef}</span>
                                      </span>
                                    )}
                                    {(q as any).supplierRef && (
                                      <span data-testid={`text-booking-supplier-${q.id}`}>
                                        Supplier Ref: <span className="font-semibold text-black/80">{(q as any).supplierRef}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="text-xs font-semibold text-black/85" data-testid={`text-${isBooking ? 'booking' : 'quote'}-total-${q.id}`}>
                                  {!isBooking && q.pricePerPerson > 0 && (
                                    <span data-testid={`text-quote-pp-${q.id}`} className="font-normal">{currency.format(q.pricePerPerson)} pp / </span>
                                  )}
                                  {q.totalCost > 0 ? currency.format(q.totalCost) : "—"}
                                </div>
                              </div>
                              <div className="flex items-end justify-between gap-3">
                                <div></div>
                                <div className="flex items-center gap-1">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === (isBooking ? "booking" : "quote") && f.itemId === q.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                                    data-testid={`button-pin-${isBooking ? 'booking' : 'quote'}-${q.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      toggleFavoriteMutation.mutate({ itemType: isBooking ? "booking" : "quote", itemId: q.id, label: q.title || (isBooking ? "Booking" : "Quote"), subtitle: `${client?.name || ""}${q.destination ? " · " + q.destination : ""}` });
                                    }}
                                    title={userFavorites?.some((f: Favorite) => f.itemType === (isBooking ? "booking" : "quote") && f.itemId === q.id) ? "Unpin" : "Pin to dashboard"}
                                  >
                                    <Pin className="h-3.5 w-3.5" />
                                  </span>
                                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60" data-testid={`button-view-${isBooking ? 'booking' : 'quote'}-${q.id}`}>
                                    View
                                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {rowsWithToggles.length === 0 ? (
                    <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={`empty-quotes-${group.id}`}>
                      <div className="text-sm font-semibold" data-testid={`text-empty-quotes-title-${group.id}`}>
                        No quotes
                      </div>
                      <div className="mt-1 text-xs text-black/55" data-testid={`text-empty-quotes-subtitle-${group.id}`}>
                        Nothing in {group.title.toLowerCase()} yet.
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
