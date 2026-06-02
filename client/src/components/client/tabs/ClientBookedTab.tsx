import {
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Pin,
  Plus,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DealImage } from "@/types/quote";
import type { Favorite } from "@/api/endpoints/favorite.api";
import { currency, formatUKDate, type BookingWithJoins, type QuoteWithJoins, type Client } from "../client-types";
import { QuoteRowCard } from "./QuoteRowCard";
import { quoteToRow } from "../hooks/use-client-quote-groups";

interface ClientBookedTabProps {
  bookings: BookingWithJoins[];
  quotes: QuoteWithJoins[];
  clientId: string;
  navigate: (to: string) => void;
  onAddBooking: () => void;
  expandedCopyGroups: Record<string, boolean>;
  setExpandedCopyGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  client: Client | null;
  userFavorites: Favorite[] | undefined;
  toggleFavoriteMutation: { mutate: (args: { itemType: string; itemId: string; label: string; subtitle: string }) => void };
  getUserName: (userId: string) => string;
}

export function ClientBookedTab({
  bookings,
  quotes,
  clientId,
  navigate,
  onAddBooking,
  expandedCopyGroups,
  setExpandedCopyGroups,
  client,
  userFavorites,
  toggleFavoriteMutation,
  getUserName,
}: ClientBookedTabProps) {
  return (
    <div className="grid gap-3" data-testid="list-booked">
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-bookings-list">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" data-testid="text-bookings-title">
              Booked Packages
            </div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-bookings-subtitle">
              Confirmed bookings for this client.
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
            data-testid="button-add-booking"
            onClick={onAddBooking}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Booking
          </Button>
        </div>

        <div className="mt-4 grid gap-2" data-testid="section-bookings">
          {bookings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-sm text-black/50" data-testid="empty-bookings">
              No bookings yet. Add a booking or convert a quote.
            </div>
          ) : (
            bookings.map((b: BookingWithJoins) => {
              // All sibling quotes from this transaction, excluding the WON quote
              // that was converted into this booking (already shown as the parent).
              const duplicates = quotes.filter(
                (q: QuoteWithJoins) => q.transaction_id === b.transaction_id && q.quote_status !== "WON",
              );
              const isExpanded = Boolean(expandedCopyGroups[b.id]);
              return (
              <div key={b.id} className="grid gap-2" data-testid={`group-booking-${b.id}`}>
              <button
                type="button"
                className="group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                data-testid={`card-booking-${b.id}`}
                onClick={() => navigate(`/clients/${clientId}/bookings/${b.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent"
                    aria-hidden
                  >
                    {b.images?.find((img: DealImage) => img.isPrimary)?.image_url || b.images?.[0]?.image_url ? (
                      <img
                        src={(b.images?.find((img: DealImage) => img.isPrimary)?.image_url || b.images?.[0]?.image_url) ?? ""}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
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
                          <div className="truncate text-sm font-semibold" data-testid={`text-booking-title-${b.id}`}>
                            {b.title || b.holiday_type_name || "Booking"}
                          </div>
                          <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {b.booking_status || "BOOKED"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                          <span data-testid={`text-booking-type-${b.id}`}>{b.holiday_type_name || "—"}</span>
                          <span className="text-black/25">•</span>
                          <span data-testid={`text-booking-traveldate-${b.id}`}>{formatUKDate(b.travel_date)}</span>
                          <span className="text-black/25">•</span>
                          <span data-testid={`text-booking-created-${b.id}`}>Created {b.date_created ? new Date(b.date_created).toLocaleDateString("en-GB") : "—"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                          <span data-testid={`text-booking-pax-${b.id}`}>{b.adult || 0}A{(b.child || 0) > 0 ? ` ${b.child}C` : ""}{(b.infant || 0) > 0 ? ` ${b.infant}I` : ""}</span>
                          {b.num_of_nights > 0 && (
                            <>
                              <span className="text-black/25">•</span>
                              <span data-testid={`text-booking-nights-${b.id}`}>{b.num_of_nights}N</span>
                            </>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-black/60">
                          {b.hays_ref && (
                            <span data-testid={`text-booking-hays-${b.id}`}>
                              HAYS Ref: <span className="font-semibold text-black/80">{b.hays_ref}</span>
                            </span>
                          )}
                          {b.supplier_ref && (
                            <span data-testid={`text-booking-supplier-${b.id}`}>
                              Supplier Ref: <span className="font-semibold text-black/80">{b.supplier_ref}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-black/60" data-testid={`text-booking-agent-${b.id}`}>
                          <UserCircle className="h-3.5 w-3.5 shrink-0 text-black/40" />
                          <span>Agent:</span>
                          <span className="font-semibold text-black/80">{b.user_id ? getUserName(b.user_id) : "Unassigned"}</span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold text-black/85" data-testid={`text-booking-total-${b.id}`}>
                          {b.sales_price && parseFloat(b.sales_price) > 0 ? currency.format(parseFloat(b.sales_price)) : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-end justify-end gap-3">
                      <div className="flex items-center gap-1">
                        <span
                          role="button"
                          tabIndex={0}
                          className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === b.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                          data-testid={`button-pin-booking-${b.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleFavoriteMutation.mutate({ itemType: "booking", itemId: b.id, label: b.title || "Booking", subtitle: `${client?.name || ""}` });
                          }}
                          title={userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === b.id) ? "Unpin" : "Pin to dashboard"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </span>
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60" data-testid={`button-view-booking-${b.id}`}>
                          View
                          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {duplicates.length > 0 && (
                <>
                  <button
                    type="button"
                    className="ml-6 inline-flex w-fit items-center gap-1 rounded-xl border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black/65 transition hover:bg-black/[0.03]"
                    data-testid={`button-toggle-copy-bookings-${b.id}`}
                    onClick={() =>
                      setExpandedCopyGroups((prev) => ({
                        ...prev,
                        [b.id]: !prev[b.id],
                      }))
                    }
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`} />
                    {isExpanded ? "Hide" : "Show"} {duplicates.length}{" "}
                    {duplicates.length === 1 ? "quote" : "quotes"}
                  </button>
                  {isExpanded &&
                    duplicates.map((q: QuoteWithJoins) => (
                      <QuoteRowCard
                        key={q.id}
                        row={quoteToRow(q, "NEW_LEAD")}
                        isChild
                        clientId={clientId}
                        navigate={navigate}
                        client={client}
                        userFavorites={userFavorites}
                        toggleFavoriteMutation={toggleFavoriteMutation}
                      />
                    ))}
                </>
              )}
              </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
