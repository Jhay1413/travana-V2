import { useState } from "react";
import { motion } from "framer-motion";
import { Tag, MapPin, Calendar, Eye, Inbox, ChevronRight, Home, Heart, RefreshCw, Globe, X, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import {
  usePortalDeals,
  usePortalDealFilters,
  usePortalForYouDeals,
  useSubmitInterest,
  type PortalDeal,
} from "@/hooks/use-portal-api";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";

type DealsTab = "latest" | "for-you";

function GlassCard({ children, className = "", ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DealCardSkeleton() {
  return (
    <GlassCard className="overflow-hidden">
      <Skeleton className="h-44 rounded-none rounded-t-3xl" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </GlassCard>
  );
}

// One card, shared by both tabs so Latest and For You can't drift apart visually.
function DealCard({
  deal,
  idx,
  interested,
  pending,
  onInterest,
}: {
  deal: PortalDeal;
  idx: number;
  interested: boolean;
  pending: boolean;
  onInterest: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
    >
      <GlassCard className="overflow-hidden" data-testid={`card-deal-${deal.id}`}>
        <div className="relative h-44">
          <img
            src={deal.image_url || defaultHeroBg}
            alt={deal.destination}
            className="w-full h-full object-cover"
            loading="lazy"
            data-testid={`img-deal-${deal.id}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {deal.price > 0 && (
            <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold" data-testid={`tag-deal-${deal.id}`}>
              {formatCurrency(deal.price)}
            </span>
          )}
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-white font-semibold text-lg" data-testid={`text-deal-title-${deal.id}`}>{deal.title}</p>
            <p className="text-white/60 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {deal.destination}
            </p>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 text-white/50 text-xs">
            {deal.hotel && (
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> {deal.hotel}
              </span>
            )}
            <span className="flex items-center gap-1.5 shrink-0">
              {deal.travel_date && <><Calendar className="w-3.5 h-3.5" /> {formatDate(deal.travel_date)}</>}
              {deal.num_nights ? ` · ${deal.num_nights} nights` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onInterest}
              disabled={interested || pending}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                interested
                  ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                  : "bg-gradient-to-r from-pink-500/80 to-rose-500/80 text-white hover:from-pink-500 hover:to-rose-500"
              }`}
              data-testid={`button-interest-${deal.id}`}
            >
              <Heart className={`w-4 h-4 ${interested ? "fill-pink-300" : ""}`} />
              {interested ? "Interested!" : "I'm Interested"}
            </button>
            {deal.quote_url && (
              <a
                href={deal.quote_url}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500/80 to-blue-500/80 text-white hover:from-purple-500 hover:to-blue-500 transition-all"
                data-testid={`button-view-deal-${deal.id}`}
              >
                <Eye className="w-4 h-4" /> View Deal
              </a>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/** Home links here with ?tab=for-you from the "For You" section's View all. */
function initialTab(): DealsTab {
  if (typeof window === "undefined") return "latest";
  return new URLSearchParams(window.location.search).get("tab") === "for-you" ? "for-you" : "latest";
}

export default function PortalDealsPage() {
  const [, setLocation] = useLocation();
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [tab, setTab] = useState<DealsTab>(initialTab);
  const { data: apiDeals, isLoading, refetch: refetchDeals } = usePortalDeals(selectedCountry, selectedTag);
  const {
    data: apiForYouDeals,
    isLoading: forYouLoading,
    refetch: refetchForYou,
  } = usePortalForYouDeals();
  const { data: filters } = usePortalDealFilters();
  const interestMutation = useSubmitInterest();
  const [interestedDeals, setInterestedDeals] = useState<Set<string>>(new Set());

  const isForYou = tab === "for-you";
  // Both lists come back already filtered to deals still live on the portal, and
  // unlike the home teasers they aren't capped — this is the "view all" surface.
  const deals = (isForYou ? apiForYouDeals : apiDeals) ?? [];
  const loading = isForYou ? forYouLoading : isLoading;

  const markInterested = (dealId: string) => {
    if (interestedDeals.has(dealId)) return;
    interestMutation.mutate(dealId, {
      onSuccess: () => setInterestedDeals((prev) => new Set(prev).add(dealId)),
    });
  };

  const popularTags = filters?.popularTags ?? [];
  const countries = filters?.countries ?? [];

  return (
    <PortalLayout>
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-deals">
          <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70">{isForYou ? "For You" : "Latest Deals"}</span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isForYou
                ? "bg-gradient-to-br from-purple-500/30 to-pink-500/30"
                : "bg-gradient-to-br from-amber-500/30 to-orange-500/30"
            }`}>
              {isForYou ? <Sparkles className="w-5 h-5 text-purple-400" /> : <Tag className="w-5 h-5 text-amber-400" />}
            </div>
            <h1 className="text-xl font-bold text-white" data-testid="text-deals-title">
              {isForYou ? "For You" : "Latest Deals"}
            </h1>
          </div>
          <button
            onClick={() => (isForYou ? refetchForYou() : refetchDeals())}
            className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.12] transition-all active:scale-90"
            data-testid="button-refresh-deals"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-1 mb-5" data-testid="tabs-deals">
          <button
            onClick={() => setTab("latest")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              !isForYou ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/60"
            }`}
            data-testid="tab-deals-latest"
          >
            <Tag className="w-3.5 h-3.5" />
            Latest Deals
          </button>
          <button
            onClick={() => setTab("for-you")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              isForYou ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/60"
            }`}
            data-testid="tab-deals-for-you"
          >
            <Sparkles className="w-3.5 h-3.5" />
            For You
            {(apiForYouDeals?.length ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-500/30 text-purple-300 text-[10px] flex items-center justify-center">
                {apiForYouDeals!.length}
              </span>
            )}
          </button>
        </div>

        {/* Country and tag filters are server-side on the Latest Deals query only —
            For You is already filtered by the client's own saved tags. */}
        {!isForYou && popularTags.length > 0 && (
          <div className="mb-4" data-testid="section-popular-tags">
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-2">Most Popular</p>
            <div className="flex flex-wrap gap-2">
              {popularTags.map(({ tag }) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? undefined : tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedTag === tag
                      ? "bg-amber-500 text-white"
                      : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                  }`}
                  data-testid={`button-tag-filter-${tag}`}
                >
                  # {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* By Country */}
        {!isForYou && countries.length > 0 && (
          <div className="mb-5" data-testid="section-country-filter">
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> By Country
            </p>
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCountry(selectedCountry === c ? undefined : c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedCountry === c
                      ? "bg-blue-500 text-white"
                      : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                  }`}
                  data-testid={`button-country-filter-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active filters summary */}
        {!isForYou && (selectedTag || selectedCountry) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {selectedTag && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                #{selectedTag}
                <button onClick={() => setSelectedTag(undefined)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedCountry && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium">
                {selectedCountry}
                <button onClick={() => setSelectedCountry(undefined)}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={() => { setSelectedTag(undefined); setSelectedCountry(undefined); }} className="text-white/30 text-xs hover:text-white/60">
              Clear all
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <DealCardSkeleton />
            <DealCardSkeleton />
          </div>
        ) : deals.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
            {isForYou ? (
              <>
                {/* For You returns nothing both when the client has saved no tags and
                    when nothing live matches them — point at tags either way, since
                    that's the only thing they can act on. */}
                <p className="text-white/60 font-medium mb-1" data-testid="text-empty-deals">Nothing for you just yet</p>
                <p className="text-white/40 text-sm mb-3">Pick the holidays you like and we'll match deals to you</p>
                <button
                  onClick={() => setLocation("/portal/tags")}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white hover:from-purple-500 hover:to-pink-500 transition-all"
                  data-testid="button-empty-for-you-tags"
                >
                  Choose your interests
                </button>
              </>
            ) : (
              <>
                <p className="text-white/60 font-medium mb-1" data-testid="text-empty-deals">No deals available</p>
                <p className="text-white/40 text-sm">Check back soon for new holiday deals</p>
              </>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {deals.map((deal: PortalDeal, idx: number) => (
              <DealCard
                key={deal.id}
                deal={deal}
                idx={idx}
                interested={interestedDeals.has(deal.id)}
                pending={interestMutation.isPending}
                onInterest={() => markInterested(deal.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
