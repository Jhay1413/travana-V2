import { useState } from "react";
import { motion } from "framer-motion";
import { Tag, MapPin, Calendar, Eye, Inbox, ChevronRight, Home, Heart, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import { usePortalDeals, useSubmitInterest, type PortalDeal } from "@/hooks/use-portal-api";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";

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

export default function PortalDealsPage() {
  const [, setLocation] = useLocation();
  const { data: apiDeals, isLoading, refetch: refetchDeals } = usePortalDeals();
  const deals = apiDeals ?? [];
  const interestMutation = useSubmitInterest();
  const [interestedDeals, setInterestedDeals] = useState<Set<string>>(new Set());

  return (
    <PortalLayout>
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-deals">
          <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70">Latest Deals</span>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
              <Tag className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white" data-testid="text-deals-title">Latest Deals</h1>
          </div>
          <button
            onClick={() => refetchDeals()}
            className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.12] transition-all active:scale-90"
            data-testid="button-refresh-deals"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <DealCardSkeleton />
            <DealCardSkeleton />
          </div>
        ) : deals.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 font-medium mb-1" data-testid="text-empty-deals">No deals available</p>
            <p className="text-white/40 text-sm">Check back soon for new holiday deals</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {deals.map((deal: PortalDeal, idx: number) => (
              <motion.div
                key={deal.id}
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
                        onClick={() => {
                          if (!interestedDeals.has(deal.id)) {
                            interestMutation.mutate(deal.id, {
                              onSuccess: () => {
                                setInterestedDeals(prev => new Set(prev).add(deal.id));
                              },
                            });
                          }
                        }}
                        disabled={interestedDeals.has(deal.id) || interestMutation.isPending}
                        className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                          interestedDeals.has(deal.id)
                            ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                            : "bg-gradient-to-r from-pink-500/80 to-rose-500/80 text-white hover:from-pink-500 hover:to-rose-500"
                        }`}
                        data-testid={`button-interest-${deal.id}`}
                      >
                        <Heart className={`w-4 h-4 ${interestedDeals.has(deal.id) ? "fill-pink-300" : ""}`} />
                        {interestedDeals.has(deal.id) ? "Interested!" : "I'm Interested"}
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
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
