import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useFreeQuotesInfinite, quoteKeys } from "@/hooks/queries/use-quote-queries";
import { useQueryClient } from "@tanstack/react-query";
import { useGeneratePost } from "@/hooks/mutations/use-social-post-mutations";
import axiosClient from "@/api/client/axios-client";
import { useToast } from "@/hooks/use-toast";
import { SocialPostPreviewDialog } from "@/components/social-post-preview-dialog";
import { QuoteCreateDialog } from "@/components/quote/quote-create-dialog";
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
  Plus,
  Bell,
  Globe,
  Star,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { EnrichedQuote } from "@/types/quote";
import type { TravelDeal } from "@/api/endpoints/social-post.api";

type ViewMode = "scheduled" | "all" | "portal";
type ScheduleFilter = "none" | "today" | "tomorrow" | "this-week" | "next-week" | "next-month" | "specific-date";

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

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const datePart = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
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
  if (!parts.length && q.park_name) parts.push(q.park_name);
  if (!parts.length && q.park_location) parts.push(q.park_location);
  return parts.join(" · ") || "—";
}

function getHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].accomodation_name || "—";
  if (q.lodge_name) return q.lodge_name;
  if (q.park_name) return q.park_name;
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


function SocialPostCard({ post, onGeneratePost, onViewPost, isGenerating, onPortalToggle, onPushNotify, onFeaturedToggle }: { post: SocialPost; onGeneratePost: (quote: EnrichedQuote) => void; onViewPost: (quote: EnrichedQuote) => void; isGenerating: boolean; onPortalToggle: (quoteId: string, checked: boolean) => void; onPushNotify: (quoteId: string) => void; onFeaturedToggle: (quoteId: string, checked: boolean) => void; }) {
  const { quote } = post;
  const imageUrl = getFirstImage(quote);
  const tourOp = quote.main_tour_operator_name;
  const pricePerPerson = quote.price_per_person ? `${formatPrice(quote.price_per_person)}pp` : formatPrice(quote.sales_price);

  // Use deal state from the enriched quote (joined from travel_deal)
  const isScheduled = !!quote.onlySocialsId;
  const hasDeal = !!quote.dealId;
  const [portalChecked, setPortalChecked] = useState(!!quote.show_on_portal);
  const [featuredChecked, setFeaturedChecked] = useState(!!quote.is_featured);
  const [pushSending, setPushSending] = useState(false);

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
            <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate" data-testid={`text-title-${quote.id}`}>{quote.title || "Untitled"}</h3>
            <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate" data-testid={`text-subtitle-${quote.id}`}>{getSubtitle(quote)}</p>
          </div>
          <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow" data-testid={`badge-price-${quote.id}`}>{pricePerPerson}</Badge>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Hotel:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-hotel-${quote.id}`}>{getHotelName(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Departing:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-departing-${quote.id}`}>{getDepartingAirport(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Nights:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-nights-${quote.id}`}>{quote.num_of_nights}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Board:</span><span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-board-${quote.id}`}>{getBoardBasis(quote)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Date:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-travel-date-${quote.id}`}>{formatDate(quote.travel_date)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Scheduled:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-scheduled-${quote.id}`}>{formatDateTime(quote.postSchedule)}</span></div>
          <div className="flex items-center gap-2 text-black/70 dark:text-white/70"><Clock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" /><span>Created:</span><span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-created-${quote.id}`}>{formatDateTime(quote.date_created)}</span></div>
        </div>
        {quote.quote_ref && <div className="text-xs text-black/60 dark:text-white/50">View Link: <a href={quote.quote_ref} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" data-testid={`link-view-${quote.id}`}>View</a></div>}
        <div className="space-y-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-portal-${quote.id}`}>
            <Checkbox
              checked={portalChecked}
              onCheckedChange={(checked) => {
                const val = !!checked;
                setPortalChecked(val);
                onPortalToggle(quote.id, val);
              }}
              className="h-4 w-4"
            />
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-black/70 dark:text-white/70 font-medium">Add to Portal</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-featured-${quote.id}`}>
            <Checkbox
              checked={featuredChecked}
              onCheckedChange={(checked) => {
                const val = !!checked;
                setFeaturedChecked(val);
                onFeaturedToggle(quote.id, val);
              }}
              className="h-4 w-4"
            />
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-black/70 dark:text-white/70 font-medium">Featured Deal</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-push-${quote.id}`}>
            <Checkbox
              checked={pushSending}
              onCheckedChange={() => {
                if (pushSending) return;
                setPushSending(true);
                onPushNotify(quote.id);
                setTimeout(() => setPushSending(false), 3000);
              }}
              className="h-4 w-4"
            />
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-black/70 dark:text-white/70 font-medium">
              {pushSending ? "Sending..." : "Push Notification to Portal"}
            </span>
          </label>
        </div>
        <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8">
          <Link href={`/social-posts/quotes/${quote.id}`}>
            <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2" data-testid={`button-view-quote-${quote.id}`}><Eye className="w-4 h-4" />View Quote</Button>
          </Link>
          <div className="mt-4" />
          {isScheduled ? (
            <Button onClick={() => onViewPost(quote)} className="w-full rounded-xl text-sm font-medium gap-2 bg-green-500 hover:bg-green-600 text-white" data-testid={`button-scheduled-${quote.id}`}><Clock className="w-4 h-4" />{formatDateTime(quote.postSchedule)}</Button>
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
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("scheduled");
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("none");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  const [previewDeal, setPreviewDeal] = useState<TravelDeal | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const generatePost = useGeneratePost();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const activeFilter = viewMode === "scheduled" ? scheduleFilter : "none";

  function computeDayRange(offsetDays: number): { rangeStart: string; rangeEnd: string } {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }

  function computePickerRange(fromStr: string, toStr: string): { rangeStart: string; rangeEnd: string } | null {
    if (!fromStr) return null;
    const [fy, fm, fd] = fromStr.split("-").map(Number);
    const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const endStr = toStr || fromStr;
    const [ty, tm, td] = endStr.split("-").map(Number);
    const end = new Date(ty, tm - 1, td, 23, 59, 59, 999);
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }

  let rangeStart = "";
  let rangeEnd = "";
  if (activeFilter === "today") {
    const r = computeDayRange(0);
    rangeStart = r.rangeStart; rangeEnd = r.rangeEnd;
  } else if (activeFilter === "tomorrow") {
    const r = computeDayRange(1);
    rangeStart = r.rangeStart; rangeEnd = r.rangeEnd;
  } else if (activeFilter === "specific-date") {
    const r = computePickerRange(dateFrom, dateTo);
    if (r) { rangeStart = r.rangeStart; rangeEnd = r.rangeEnd; }
  }

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFreeQuotesInfinite(12, viewMode === "scheduled", activeFilter, debouncedSearch, rangeStart, rangeEnd);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filteredPosts = useMemo<SocialPost[]>(() => {
    if (!data?.pages) return [];
    const allQuotes: SocialPost[] = [];
    data.pages.forEach((page) => { page.quotes.forEach((quote) => { allQuotes.push({ quote: quote as EnrichedQuote, clientId: quote.client_id || "" }); }); });
    if (viewMode === "portal") return allQuotes.filter((p) => p.quote.show_on_portal);
    return allQuotes;
  }, [data, viewMode]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); }, { threshold: 0.1 });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleGeneratePost = async (quote: EnrichedQuote) => {
    if (!quote.travel_date) {
      toast({ title: "Cannot generate post — travel date is missing", variant: "destructive" });
      return;
    }

    const imageUrl = getFirstImage(quote);
    setPreviewQuoteId(quote.id);
    setPreviewImageUrl(imageUrl);
    setPreviewDeal(null);
    try {
      const isHotTub = quote.quote_type === "hot_tub_break";
      const destination = isHotTub
        ? [quote.park_name, quote.park_location].filter(Boolean).join(", ") || "Unknown"
        : [quote.country_name, quote.destination_name].filter(Boolean).join(", ") || "Unknown";
      const nights = quote.num_of_nights > 0 ? quote.num_of_nights : 1;
      const boardBasis = !isHotTub && getBoardBasis(quote) !== "—" ? getBoardBasis(quote) : undefined;
      const departureAirport = !isHotTub && getDepartingAirport(quote) !== "—" ? getDepartingAirport(quote) : undefined;
      const deal = await generatePost.mutateAsync({
        quoteId: quote.id,
        title: quote.title || "Holiday Deal",
        destination,
        nights,
        boardBasis,
        departureAirport,
        transferType: quote.transfer_type || undefined,
        salesPrice: quote.sales_price || undefined,
        pricePerPerson: quote.price_per_person || undefined,
        travelDate: quote.travel_date,
        quoteType: quote.quote_type,
        lodgeName: quote.lodge_name || undefined,
        parkName: quote.park_name || undefined,
        parkLocation: quote.park_location || undefined,
      });
      setPreviewDeal(deal);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to generate post";
      toast({ title: message, variant: "destructive" });
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

  const handlePortalToggle = useCallback(async (quoteId: string, checked: boolean) => {
    try {
      await axiosClient.patch(`/api/v2/quotes/${quoteId}/portal-visibility`, { show_on_portal: checked });
      toast({ title: checked ? "Added to portal" : "Removed from portal" });
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
    } catch {
      toast({ title: "Failed to update portal visibility", variant: "destructive" });
    }
  }, [toast, queryClient]);

  const handleFeaturedToggle = useCallback(async (quoteId: string, checked: boolean) => {
    try {
      await axiosClient.patch(`/api/v2/quotes/${quoteId}/featured`, { is_featured: checked });
      toast({ title: checked ? "Marked as featured deal" : "Removed from featured deals" });
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
    } catch {
      toast({ title: "Failed to update featured status", variant: "destructive" });
    }
  }, [toast, queryClient]);

  const handlePushNotify = useCallback(async (quoteId: string) => {
    try {
      const res = await axiosClient.post(`/api/v2/quotes/${quoteId}/portal-push`);
      const sent = res?.data?.sent ?? 0;
      toast({ title: `Push notification sent to ${sent} device${sent !== 1 ? "s" : ""}` });
    } catch {
      toast({ title: "Failed to send push notification", variant: "destructive" });
    }
  }, [toast]);

  function handleScheduleFilterClick(value: ScheduleFilter) {
    setScheduleFilter(value);
    if (value !== "specific-date") {
      setDateFrom("");
      setDateTo("");
    }
  }

  const scheduleFilterButtons: { label: string; value: ScheduleFilter }[] = [
    { label: "All Scheduled", value: "none" },
    { label: "Today", value: "today" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "This Week", value: "this-week" },
    { label: "Next Week", value: "next-week" },
    { label: "Next Month", value: "next-month" },
    { label: "Pick Date", value: "specific-date" },
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
            <Button
              size="sm"
              variant={viewMode === "portal" ? "default" : "outline"}
              className={`rounded-xl text-xs font-medium ${viewMode === "portal" ? "bg-purple-500 hover:bg-purple-600 text-white" : "border-black/10 dark:border-white/10"}`}
              onClick={() => { setViewMode("portal"); setScheduleFilter("none"); }}
              data-testid="button-view-portal"
            >
              <Globe className="w-3.5 h-3.5 mr-1" />Portal Posts
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white gap-1.5"
              onClick={() => setCreateDialogOpen(true)}
              data-testid="button-create-social-post"
            >
              <Plus className="w-3.5 h-3.5" />Create Social Post
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
                onClick={() => handleScheduleFilterClick(btn.value)}
                data-testid={`button-schedule-filter-${btn.value}`}
              >
                {btn.label}
              </Button>
            ))}
            {scheduleFilter === "specific-date" && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl text-xs font-medium px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/80 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-date-from-filter"
                />
                <span className="text-xs text-black/50 dark:text-white/50">to</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl text-xs font-medium px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/80 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-date-to-filter"
                />
              </div>
            )}
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
            {viewMode === "scheduled" ? "No scheduled posts match your filters" : viewMode === "portal" ? "No posts have been added to the portal yet" : "Try adjusting your search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (<SocialPostCard key={post.quote.id} post={post} onGeneratePost={handleGeneratePost} onViewPost={handleViewPost} isGenerating={generatePost.isPending && previewQuoteId === post.quote.id} onPortalToggle={handlePortalToggle} onPushNotify={handlePushNotify} onFeaturedToggle={handleFeaturedToggle} />))}
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

      <QuoteCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        socialPost
        onSuccess={() => setCreateDialogOpen(false)}
      />
    </div>
  );
}
