import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useFreeQuotesInfinite } from "@/hooks/queries/use-quote-queries";
import { useGeneratePost } from "@/hooks/mutations/use-social-post-mutations";
import { useToast } from "@/hooks/use-toast";
import { SocialPostPreviewDialog } from "@/components/social-post-preview-dialog";
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
  Sparkles,
  Clock,
} from "lucide-react";
import type { EnrichedQuote } from "@/types/quote";
import type { TravelDeal } from "@/api/endpoints/social-post.api";

type ViewMode = "scheduled" | "all";
type ScheduleFilter = "none" | "this-week" | "next-week" | "next-month";

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

function getSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  return parts.join(" · ") || "—";
}

function getHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].accomodation_name || "—";
  return "—";
}

function getDepartingAirport(q: EnrichedQuote): string {
  const flights = q.flights ?? [];
  const outbound = flights.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null)) ?? flights.find((f) => f.flight_type === "outbound") ?? flights[0];
  return outbound?.departing_airport_name || q.departing_airport_name || "—";
}

function getBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].board_basis_name || "—";
  return "—";
}

function getFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}


function SocialPostCard({ post, onGeneratePost, onViewPost, isGenerating }: { post: SocialPost; onGeneratePost: (quote: EnrichedQuote) => void; onViewPost: (quote: EnrichedQuote) => void; isGenerating: boolean; }) {
  const { quote } = post;
  const imageUrl = getFirstImage(quote);
  const tourOp = quote.main_tour_operator_name;
  const pricePerPerson = quote.price_per_person ? `${formatPrice(quote.price_per_person)}pp` : formatPrice(quote.sales_price);

  // Use deal state from the enriched quote (joined from travel_deal)
  const isScheduled = !!quote.onlySocialsId;
  const hasDeal = !!quote.dealId;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="glass ringed grain rounded-2xl overflow-hidden flex flex-col" data-testid={`card-social-post-${quote.id}`}>
      <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={quote.title || "Deal image"} className="w-full h-full object-cover" data-testid={`img-social-post-${quote.id}`} />
        ) : (
          <img src="/images/default-hotel.jpg" alt="Default hotel" className="w-full h-full object-cover" />
        )}
        {tourOp && <Badge className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full" data-testid={`badge-tour-op-${quote.id}`}>{tourOp}</Badge>}
        {isScheduled && (
          <Badge className="absolute top-3 right-3 bg-green-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full">
            <Clock className="w-3 h-3 mr-1 inline" />Scheduled
          </Badge>
        )}
      </div>
      <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate" data-testid={`text-title-${quote.id}`}>Title: <span className="font-semibold">{quote.title || "Untitled"}</span></h3>
            <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate" data-testid={`text-subtitle-${quote.id}`}>Sub: {getSubtitle(quote)}</p>
          </div>
          <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow" data-testid={`badge-price-${quote.id}`}>{pricePerPerson}</Badge>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Hotel:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-hotel-${quote.id}`}>{getHotelName(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Departing:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-departing-${quote.id}`}>{getDepartingAirport(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Nights:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-nights-${quote.id}`}>{quote.num_of_nights}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Board:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-board-${quote.id}`}>{getBoardBasis(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Date:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-travel-date-${quote.id}`}>{formatDate(quote.travel_date)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Scheduled:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-scheduled-${quote.id}`}>{formatDate(quote.postSchedule)}</span></div>
        </div>
        {quote.quote_ref && <div className="text-xs text-black/60 dark:text-white/50">View Link: <a href={quote.quote_ref} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" data-testid={`link-view-${quote.id}`}>View</a></div>}
        <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8">
          <Link href={`/social-posts/quotes/${quote.id}`}>
            <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2" data-testid={`button-view-quote-${quote.id}`}><Eye className="w-4 h-4" />View Quote</Button>
          </Link>
          <div className="mt-4" />
          {isScheduled ? (
            <Button onClick={() => onViewPost(quote)} className="w-full rounded-xl text-sm font-medium gap-2 bg-green-500 hover:bg-green-600 text-white" data-testid={`button-scheduled-${quote.id}`}><Clock className="w-4 h-4" />Scheduled</Button>
          ) : hasDeal ? (
            <Button onClick={() => onViewPost(quote)} className="w-full rounded-xl text-sm font-medium gap-2 bg-orange-500 hover:bg-orange-600 text-white" data-testid={`button-schedule-post-${quote.id}`}><CalendarClock className="w-4 h-4" />Schedule Post</Button>
          ) : (
            <Button onClick={() => onGeneratePost(quote)} disabled={isGenerating} className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white" data-testid={`button-generate-post-${quote.id}`}>
              {isGenerating ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              Generate Post
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialPostsBoard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("scheduled");
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("none");
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  const [previewDeal, setPreviewDeal] = useState<TravelDeal | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const generatePost = useGeneratePost();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFreeQuotesInfinite(12, viewMode === "scheduled", viewMode === "scheduled" ? scheduleFilter : "none");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); }, { threshold: 0.1 });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const socialPosts = useMemo<SocialPost[]>(() => {
    if (!data?.pages) return [];
    const allQuotes: SocialPost[] = [];
    data.pages.forEach((page) => { page.quotes.forEach((quote) => { allQuotes.push({ quote: quote as EnrichedQuote, clientId: quote.client_id || "" }); }); });
    return allQuotes;
  }, [data]);

  const filteredPosts = useMemo(() => {
    let result = socialPosts;

    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase();
      result = result.filter(({ quote: q }) =>
        (q.title || "").toLowerCase().includes(needle) ||
        getHotelName(q).toLowerCase().includes(needle) ||
        getDepartingAirport(q).toLowerCase().includes(needle) ||
        getSubtitle(q).toLowerCase().includes(needle) ||
        (q.main_tour_operator_name || "").toLowerCase().includes(needle)
      );
    }

    return result;
  }, [socialPosts, searchQuery]);

  const handleGeneratePost = async (quote: EnrichedQuote) => {
    const imageUrl = getFirstImage(quote);
    setPreviewQuoteId(quote.id);
    setPreviewImageUrl(imageUrl);
    setPreviewDeal(null);
    try {
      const destination = [quote.country_name, quote.destination_name].filter(Boolean).join(", ") || "Unknown";
      const deal = await generatePost.mutateAsync({ quoteId: quote.id, title: quote.title || "Untitled Deal", destination, nights: quote.num_of_nights, boardBasis: getBoardBasis(quote) !== "—" ? getBoardBasis(quote) : undefined, departureAirport: getDepartingAirport(quote) !== "—" ? getDepartingAirport(quote) : undefined, transferType: quote.transfer_type || undefined, salesPrice: quote.sales_price || undefined, pricePerPerson: quote.price_per_person || undefined, travelDate: quote.travel_date });
      setPreviewDeal(deal);
    } catch {
      toast({ title: "Failed to generate post", variant: "destructive" });
      setPreviewQuoteId(null);
    }
  };

  const handleViewPost = (quote: EnrichedQuote) => {
    const imageUrl = getFirstImage(quote);
    setPreviewQuoteId(quote.id);
    setPreviewImageUrl(imageUrl);
    setPreviewDeal(null);
    import("@/api/endpoints/social-post.api").then(({ socialPostApi }) => {
      socialPostApi.getByQuoteId(quote.id).then((deal) => { if (deal) setPreviewDeal(deal); });
    });
  };

  const scheduleFilterButtons: { label: string; value: ScheduleFilter }[] = [
    { label: "All Scheduled", value: "none" },
    { label: "This Week", value: "this-week" },
    { label: "Next Week", value: "next-week" },
    { label: "Next Month", value: "next-month" },
  ];

  return (
    <div className="space-y-4">
      <div className="glass ringed grain rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 dark:text-white/40" />
            <Input placeholder="Search by title, hotel, airport, destination..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10" data-testid="input-search-social-posts" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === "scheduled" ? "default" : "outline"}
              className={`rounded-xl text-xs font-medium ${viewMode === "scheduled" ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-black/10 dark:border-white/10"}`}
              onClick={() => { setViewMode("scheduled"); setScheduleFilter("none"); }}
              data-testid="button-view-scheduled"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />Scheduled
            </Button>
            <Button
              size="sm"
              variant={viewMode === "all" ? "default" : "outline"}
              className={`rounded-xl text-xs font-medium ${viewMode === "all" ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-black/10 dark:border-white/10"}`}
              onClick={() => { setViewMode("all"); setScheduleFilter("none"); }}
              data-testid="button-view-all"
            >
              Show All
            </Button>
          </div>
        </div>

        {viewMode === "scheduled" && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {scheduleFilterButtons.map((btn) => (
              <Button
                key={btn.value}
                size="sm"
                variant={scheduleFilter === btn.value ? "default" : "outline"}
                className={`rounded-xl text-xs font-medium ${scheduleFilter === btn.value ? "bg-green-500 hover:bg-green-600 text-white" : "border-black/10 dark:border-white/10"}`}
                onClick={() => setScheduleFilter(btn.value)}
                data-testid={`button-schedule-filter-${btn.value}`}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-black/55 dark:text-white/55" data-testid="text-results-count">{filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"} found</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : isError ? (
        <div className="glass ringed grain rounded-2xl p-12 text-center"><p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load posts. Please try refreshing the page.</p></div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass ringed grain rounded-2xl p-12 text-center">
          <CalendarClock className="w-12 h-12 mx-auto text-black/20 dark:text-white/20 mb-3" />
          <p className="text-sm font-medium text-black/60 dark:text-white/60">No posts found</p>
          <p className="text-xs text-black/40 dark:text-white/40 mt-1">
            {viewMode === "scheduled" ? "No scheduled posts match your filters" : "Try adjusting your search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (<SocialPostCard key={post.quote.id} post={post} onGeneratePost={handleGeneratePost} onViewPost={handleViewPost} isGenerating={generatePost.isPending && previewQuoteId === post.quote.id} />))}
          </AnimatePresence>
        </div>
      )}

      {!isError && !isLoading && filteredPosts.length > 0 && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {isFetchingNextPage && <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60"><Spinner className="w-5 h-5" /><span>Loading more posts...</span></div>}
          {!hasNextPage && filteredPosts.length > 0 && <p className="text-sm text-black/40 dark:text-white/40">No more posts to load</p>}
        </div>
      )}

      <SocialPostPreviewDialog
        open={!!previewQuoteId}
        onOpenChange={(open) => { if (!open) { setPreviewQuoteId(null); setPreviewDeal(null); setPreviewImageUrl(null); } }}
        travelDeal={previewDeal}
        quoteImageUrl={previewImageUrl}
        isGenerating={generatePost.isPending}
        quoteId={previewQuoteId}
      />
    </div>
  );
}
