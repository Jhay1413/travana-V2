import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { useFreeQuotesInfinite } from "@/hooks/queries/use-quote-queries";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Eye,
  CalendarClock,
  Calendar,
  Plane,
  Hotel,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import type { EnrichedQuote } from "@/types/quote";

type DateFilter = "all" | "today" | "tomorrow" | "custom";

interface SocialPost {
  quote: EnrichedQuote;
  clientId: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPrice(price: string | null | undefined): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `£${num.toFixed(2)}`;
}

function isSameDay(dateStr: string | null | undefined, target: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function getSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  return parts.join(" · ") || "—";
}

function getHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) {
    return q.accommodations[0].accomodation_name || "—";
  }
  return "—";
}

function getDepartingAirport(q: EnrichedQuote & { departing_airport_name?: string }): string {
  const flights = q.flights ?? [];
  const outbound =
    flights.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null)) ??
    flights.find((f) => f.flight_type === "outbound") ??
    flights[0];
  return outbound?.departing_airport_name || q.departing_airport_name || "—";
}

function getBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) {
    return q.accommodations[0].board_basis_name || "—";
  }
  return "—";
}

function getFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const { quote, clientId } = post;
  console.log(post)
  console.log(clientId, "Rendering SocialPostCard for quote ID:", quote.id);
  const imageUrl = getFirstImage(quote);
  const tourOp = quote.main_tour_operator_name;
  const pricePerPerson = quote.price_per_person
    ? `${formatPrice(quote.price_per_person)}pp`
    : formatPrice(quote.sales_price);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
      data-testid={`card-social-post-${quote.id}`}
    >
      <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={quote.title || "Deal image"}
            className="w-full h-full object-cover"
            data-testid={`img-social-post-${quote.id}`}
          />
        ) : (
          <img
            src="/images/default-hotel.jpg"
            alt="Default hotel"
            className="w-full h-full object-cover"
          />
        )}
        {tourOp && (
          <Badge
            className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full"
            data-testid={`badge-tour-op-${quote.id}`}
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
              data-testid={`text-title-${quote.id}`}
            >
              Title: <span className="font-semibold">{quote.title || "Untitled"}</span>
            </h3>
            <p
              className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate"
              data-testid={`text-subtitle-${quote.id}`}
            >
              Sub: {getSubtitle(quote)}
            </p>
          </div>
          <Badge
            className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow"
            data-testid={`badge-price-${quote.id}`}
          >
            {pricePerPerson}
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Hotel:</span>
            <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-hotel-${quote.id}`}>
              {getHotelName(quote)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Departing:</span>
            <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-departing-${quote.id}`}>
              {getDepartingAirport(quote)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Nights:</span>
            <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-nights-${quote.id}`}>
              {quote.num_of_nights}
            </span>
          </div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Board:</span>
            <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-board-${quote.id}`}>
              {getBoardBasis(quote)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Date:</span>
            <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-travel-date-${quote.id}`}>
              {formatDate(quote.travel_date)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
            <span>Date Created:</span>
            <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-created-${quote.id}`}>
              {formatDate(quote.date_created)}
            </span>
          </div>
        </div>

        {quote.deal_id && (
          <div className="text-xs text-black/60 dark:text-white/50">
            Live Deal:{" "}
            <a
              href="#"
              className="text-blue-500 hover:underline"
              data-testid={`link-deal-${quote.id}`}
            >
              View Deal
            </a>
          </div>
        )}

        <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8">
          <Link href={`/quotes/${quote.id}`}>
            <Button
              variant="outline"
              className="w-full rounded-xl text-sm font-medium gap-2"
              data-testid={`button-view-quote-${quote.id}`}
            >
              <Eye className="w-4 h-4" />
              View Quote
            </Button>
          </Link>
          <div className="mt-4" />
          <Button
            className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white"
            data-testid={`button-schedule-post-${quote.id}`}
          >
            <CalendarClock className="w-4 h-4" />
            Schedule Post
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialPostsPage() {
  const { role, setRole } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFreeQuotesInfinite(12);

  // Ref for infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into a single array of social posts
  const socialPosts = useMemo<SocialPost[]>(() => {
    if (!data?.pages) return [];
    
    const allQuotes: SocialPost[] = [];
    
    data.pages.forEach((page) => {
      page.quotes.forEach((quote) => {
        allQuotes.push({
          quote: quote as EnrichedQuote,
          clientId: quote.client_id || "",
        });
      });
    });
    
    return allQuotes;
  }, [data]);
  
  const filteredPosts = useMemo(() => {
    let result = socialPosts;

    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase();
      result = result.filter(({ quote: q }) => {
        const title = (q.title || "").toLowerCase();
        const hotel = getHotelName(q).toLowerCase();
        const airport = getDepartingAirport(q).toLowerCase();
        const subtitle = getSubtitle(q).toLowerCase();
        const tourOp = (q.main_tour_operator_name || "").toLowerCase();
        return (
          title.includes(needle) ||
          hotel.includes(needle) ||
          airport.includes(needle) ||
          subtitle.includes(needle) ||
          tourOp.includes(needle)
        );
      });
    }

    if (dateFilter === "today") {
      const today = new Date();
      result = result.filter(({ quote: q }) => isSameDay(q.date_created, today));
    } else if (dateFilter === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      result = result.filter(({ quote: q }) => isSameDay(q.date_created, tomorrow));
    } else if (dateFilter === "custom" && customDate) {
      const target = new Date(customDate + "T00:00:00");
      result = result.filter(({ quote: q }) => isSameDay(q.date_created, target));
    }

    return result;
  }, [socialPosts, searchQuery, dateFilter, customDate]);

  const dateButtons: { label: string; value: DateFilter }[] = [
    { label: "All", value: "all" },
    { label: "Today", value: "today" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "By Date", value: "custom" },
  ];

  return (
    <CommandCenterShell
      active="social-posts"
      title="Social Posts"
      subtitle="Browse and schedule social media posts from your quotes"
      role={role}
      onRoleChange={setRole}
    >
      <div className="space-y-4">
        <div className="glass ringed grain rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 dark:text-white/40" />
              <Input
                placeholder="Search by title, hotel, airport, destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                data-testid="input-search-social-posts"
              />
            </div>
            <div className="flex items-center gap-2">
              {dateButtons.map((btn) => (
                <Button
                  key={btn.value}
                  size="sm"
                  variant={dateFilter === btn.value ? "default" : "outline"}
                  className={`rounded-xl text-xs font-medium ${
                    dateFilter === btn.value
                      ? "bg-blue-500 hover:bg-blue-600 text-white"
                      : "border-black/10 dark:border-white/10"
                  }`}
                  onClick={() => setDateFilter(btn.value)}
                  data-testid={`button-filter-${btn.value}`}
                >
                  {btn.label}
                </Button>
              ))}
              <AnimatePresence>
                {dateFilter === "custom" && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-40 rounded-xl text-xs bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                      data-testid="input-custom-date"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-black/55 dark:text-white/55" data-testid="text-results-count">
            {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"} found
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-8 h-8" />
          </div>
        ) : isError ? (
          <div className="glass ringed grain rounded-2xl p-12 text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Failed to load posts. Please try refreshing the page.
            </p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="glass ringed grain rounded-2xl p-12 text-center">
            <CalendarClock className="w-12 h-12 mx-auto text-black/20 dark:text-white/20 mb-3" />
            <p className="text-sm font-medium text-black/60 dark:text-white/60">
              No posts found
            </p>
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">
              Try adjusting your search or date filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post) => (
                <SocialPostCard key={post.quote.id} post={post} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Infinite scroll trigger */}
        {!isError && !isLoading && filteredPosts.length > 0 && (
          <div 
            ref={loadMoreRef} 
            className="flex items-center justify-center py-8"
          >
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
                <Spinner className="w-5 h-5" />
                <span>Loading more posts...</span>
              </div>
            )}
            {!hasNextPage && filteredPosts.length > 0 && (
              <p className="text-sm text-black/40 dark:text-white/40">
                No more posts to load
              </p>
            )}
          </div>
        )}
      </div>
    </CommandCenterShell>
  );
}
