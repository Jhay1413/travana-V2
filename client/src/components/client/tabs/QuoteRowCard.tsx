import { ChevronRight, ImagePlus, Pin } from "lucide-react";
import type { Favorite } from "@/api/endpoints/favorite.api";
import { currency, formatUKDate, type Client } from "../client-types";

export interface QuoteRowCardData {
  id: string;
  transactionId: string;
  title: string;
  isQuoteCopy: boolean;
  destination: string;
  travelDate: string;
  createdAt: string;
  createdAtRaw: string;
  status: string;
  totalCost: number;
  pricePerPerson: number;
  imageUrl: string | null;
  pax: string;
  nights: number;
  haysRef?: string | null;
  supplierRef?: string | null;
  isBooking?: boolean;
}

interface QuoteRowCardProps {
  row: QuoteRowCardData;
  isChild: boolean;
  clientId: string;
  navigate: (to: string) => void;
  client: Client | null;
  userFavorites: Favorite[] | undefined;
  toggleFavoriteMutation: {
    mutate: (args: { itemType: string; itemId: string; label: string; subtitle: string }) => void;
  };
}

export function QuoteRowCard({
  row: q,
  isChild,
  clientId,
  navigate,
  client,
  userFavorites,
  toggleFavoriteMutation,
}: QuoteRowCardProps) {
  const isBooking = !!q.isBooking;
  const itemType = isBooking ? "booking" : "quote";
  const isPinned = userFavorites?.some((f: Favorite) => f.itemType === itemType && f.itemId === q.id);

  return (
    <button
      type="button"
      className={`group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99] ${
        isChild ? "pl-9 border-sky-500/20 bg-sky-500/[0.04]" : ""
      }`}
      data-testid={`card-${itemType}-intro-${q.id}`}
      onClick={() => navigate(`/clients/${clientId}/${isBooking ? "bookings" : "quotes"}/${q.id}`)}
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
                <div className="truncate text-sm font-semibold" data-testid={`text-${itemType}-title-${q.id}`}>
                  {q.title}
                </div>
                {isBooking && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {q.status}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                <span data-testid={`text-${itemType}-destination-${q.id}`}>{q.destination || "—"}</span>
                <span className="text-black/25">•</span>
                <span data-testid={`text-${itemType}-traveldate-${q.id}`}>{formatUKDate(q.travelDate)}</span>
                <span className="text-black/25">•</span>
                <span data-testid={`text-${itemType}-created-${q.id}`}>Created {q.createdAt || "—"}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                <span data-testid={`text-${itemType}-pax-${q.id}`}>{q.pax}</span>
                {q.nights > 0 && (
                  <>
                    <span className="text-black/25">•</span>
                    <span data-testid={`text-${itemType}-nights-${q.id}`}>{q.nights}N</span>
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
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                        q.status === "LOST"
                          ? "border-rose-500/25 bg-rose-500/10 text-rose-700"
                          : "border-black/10 bg-white/70 text-black/60"
                      }`}
                      data-testid={`text-quote-status-${q.id}`}
                    >
                      {(q.status || "").replace(/_/g, " ")}
                    </span>
                  </>
                )}
              </div>
              {isBooking && (q.haysRef || q.supplierRef) && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-black/60">
                  {q.haysRef && (
                    <span data-testid={`text-booking-hays-${q.id}`}>
                      HAYS Ref: <span className="font-semibold text-black/80">{q.haysRef}</span>
                    </span>
                  )}
                  {q.supplierRef && (
                    <span data-testid={`text-booking-supplier-${q.id}`}>
                      Supplier Ref: <span className="font-semibold text-black/80">{q.supplierRef}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xs font-semibold text-black/85" data-testid={`text-${itemType}-total-${q.id}`}>
                {!isBooking && q.pricePerPerson > 0 && (
                  <span data-testid={`text-quote-pp-${q.id}`} className="font-normal">
                    {currency.format(q.pricePerPerson)} pp /{" "}
                  </span>
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
                  className={`grid h-7 w-7 place-items-center rounded-full transition ${
                    isPinned
                      ? "text-amber-600 hover:bg-amber-50"
                      : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"
                  }`}
                  data-testid={`button-pin-${itemType}-${q.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFavoriteMutation.mutate({
                      itemType,
                      itemId: q.id,
                      label: q.title || (isBooking ? "Booking" : "Quote"),
                      subtitle: `${client?.name || ""}${q.destination ? " · " + q.destination : ""}`,
                    });
                  }}
                  title={isPinned ? "Unpin" : "Pin to dashboard"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </span>
                <div
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60"
                  data-testid={`button-view-${itemType}-${q.id}`}
                >
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
}
