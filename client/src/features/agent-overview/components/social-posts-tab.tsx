import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Calendar,
  CalendarClock,
  Eye,
  Hotel,
  Moon,
  Plane,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useFreeQuotesInfinite } from "@/features/quote/api/use-quote-queries";
import type { EnrichedQuote } from "@/features/quote/types";
import {
  spFormatDate,
  spFormatPrice,
  spGetBoardBasis,
  spGetDepartingAirport,
  spGetFirstImage,
  spGetHotelName,
  spGetSubtitle,
} from "./helpers";

export type SocialFilter = "all" | "today" | "tomorrow" | "range";

export function SocialPostsTab({
  tab,
  socialFilter,
  socialDateFrom,
  socialDateTo,
  setSocialFilter,
  setSocialDateFrom,
  setSocialDateTo,
}: {
  tab: string;
  socialFilter: SocialFilter;
  socialDateFrom: string;
  socialDateTo: string;
  setSocialFilter: (f: SocialFilter) => void;
  setSocialDateFrom: (d: string) => void;
  setSocialDateTo: (d: string) => void;
}) {
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (socialFilter === "all") return { rangeStart: "", rangeEnd: "" };
    if (socialFilter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
    }
    if (socialFilter === "tomorrow") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
    }
    if (socialFilter === "range" && socialDateFrom && socialDateTo) {
      const start = new Date(socialDateFrom + "T00:00:00");
      const end = new Date(socialDateTo + "T23:59:59.999");
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
    }
    return { rangeStart: "", rangeEnd: "" };
  }, [socialFilter, socialDateFrom, socialDateTo]);

  const { data: freeQuotesData } = useFreeQuotesInfinite(
    50,
    true,
    "none",
    "",
    rangeStart,
    rangeEnd,
    { enabled: tab === "calendar" },
  );

  const overviewSocialPosts = useMemo(() => {
    if (!freeQuotesData) return [] as { quote: EnrichedQuote; clientId: string }[];
    const posts: { quote: EnrichedQuote; clientId: string }[] = [];
    for (const page of freeQuotesData.pages) {
      for (const q of page.quotes) {
        posts.push({ quote: q as EnrichedQuote, clientId: (q as any).client_id || "" });
      }
    }
    return posts;
  }, [freeQuotesData]);

  const filteredOverviewSocialPosts = overviewSocialPosts;

  return (
    <div className="space-y-3" data-testid="panel-overview-social-posts">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5"
          data-testid="group-overview-social-filters"
        >
          {(["all", "today", "tomorrow", "range"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSocialFilter(f)}
              className={
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                (socialFilter === f
                  ? "bg-[#3b82f6] text-white"
                  : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
              }
              data-testid={`filter-overview-social-${f}`}
            >
              {f === "all"
                ? "All Time"
                : f === "range"
                  ? "Date Range"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div
          className={
            (socialFilter === "range" ? "flex" : "hidden") +
            " items-center gap-2 flex-wrap"
          }
          data-testid="wrap-overview-social-date"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-black/50 dark:text-white/50">From</span>
            <DatePicker
              value={socialDateFrom}
              onChange={(v) => setSocialDateFrom(v)}
              placeholder="Start date"
              data-testid="input-overview-social-date-from"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-black/50 dark:text-white/50">To</span>
            <DatePicker
              value={socialDateTo}
              onChange={(v) => setSocialDateTo(v)}
              placeholder="End date"
              data-testid="input-overview-social-date-to"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-black/50 dark:text-white/50">
        {filteredOverviewSocialPosts.length}{" "}
        {filteredOverviewSocialPosts.length === 1 ? "post" : "posts"} found
      </p>

      {filteredOverviewSocialPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
          <CalendarClock className="w-10 h-10 mx-auto text-black/15 dark:text-white/15 mb-2" />
          <p className="text-sm text-black/50 dark:text-white/50">No posts for this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredOverviewSocialPosts.slice(0, 8).map(({ quote, clientId }) => {
              const imageUrl = spGetFirstImage(quote);
              const tourOp = quote.main_tour_operator_name;
              const pricePerPerson = quote.price_per_person
                ? `${spFormatPrice(quote.price_per_person)}pp`
                : spFormatPrice(quote.sales_price);
              return (
                <motion.div
                  key={quote.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
                  data-testid={`card-overview-social-post-${quote.id}`}
                >
                  <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                    <img
                      src={imageUrl || "/images/default-hotel.jpg"}
                      alt={quote.title || "Deal image"}
                      className="w-full h-full object-cover"
                      data-testid={`img-overview-social-post-${quote.id}`}
                    />
                    {tourOp && (
                      <Badge
                        className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full"
                        data-testid={`badge-tour-op-overview-${quote.id}`}
                      >
                        {tourOp}
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-sm font-bold text-black/90 dark:text-white/90 truncate"
                          data-testid={`text-overview-title-${quote.id}`}
                        >
                          Title:{" "}
                          <span className="font-semibold">{quote.title || "Untitled"}</span>
                        </h3>
                        <p
                          className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate"
                          data-testid={`text-overview-subtitle-${quote.id}`}
                        >
                          Sub: {spGetSubtitle(quote)}
                        </p>
                      </div>
                      <Badge
                        className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow"
                        data-testid={`badge-price-overview-${quote.id}`}
                      >
                        {pricePerPerson}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Hotel:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90 truncate"
                          data-testid={`text-overview-hotel-${quote.id}`}
                        >
                          {spGetHotelName(quote)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Departing:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90 truncate"
                          data-testid={`text-overview-departing-${quote.id}`}
                        >
                          {spGetDepartingAirport(quote)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Nights:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90"
                          data-testid={`text-overview-nights-${quote.id}`}
                        >
                          {quote.num_of_nights}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Board:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90 truncate"
                          data-testid={`text-overview-board-${quote.id}`}
                        >
                          {spGetBoardBasis(quote)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Date:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90"
                          data-testid={`text-overview-travel-date-${quote.id}`}
                        >
                          {spFormatDate(quote.travel_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                        <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                        <span>Date Created:</span>
                        <span
                          className="font-semibold text-black/90 dark:text-white/90"
                          data-testid={`text-overview-created-${quote.id}`}
                        >
                          {spFormatDate(quote.date_created)}
                        </span>
                      </div>
                    </div>

                    {quote.quote_ref && (
                      <div className="text-xs text-black/60 dark:text-white/50">
                        View Link:{" "}
                        <a
                          href={quote.quote_ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                          data-testid={`link-view-overview-${quote.id}`}
                        >
                          View
                        </a>
                      </div>
                    )}

                    <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8 flex flex-col gap-3">
                      <Link href={`/clients/${clientId}/quotes/${quote.id}`}>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl text-sm font-medium gap-2"
                          data-testid={`button-view-quote-overview-${quote.id}`}
                        >
                          <Eye className="w-4 h-4" />
                          View Quote
                        </Button>
                      </Link>
                      {quote.postSchedule ? (
                        <Button
                          className="w-full rounded-xl text-sm font-medium gap-2 bg-green-500 hover:bg-green-600 text-white"
                          data-testid={`button-scheduled-overview-${quote.id}`}
                        >
                          <CalendarClock className="w-4 h-4" />
                          Scheduled: {spFormatDate(quote.postSchedule)}
                        </Button>
                      ) : (
                        <Button
                          className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                          data-testid={`button-schedule-post-overview-${quote.id}`}
                        >
                          <CalendarClock className="w-4 h-4" />
                          Schedule Post
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {filteredOverviewSocialPosts.length > 6 && (
        <div className="text-center pt-2">
          <Link href="/social-posts">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              data-testid="link-view-all-social-posts"
            >
              View all {filteredOverviewSocialPosts.length} posts →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
